/**
 * WebSocket bridge between the browser overlay and the MCP server.
 *
 * The browser overlay connects via ws://127.0.0.1:{port}/ws.
 * The MCP server sends requests through this bridge to the browser,
 * and receives pushed changes from the browser.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

type RequestHandler = (result: any) => void;

export class Bridge {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private port: number;
  private host = "127.0.0.1";
  private requestId = 0;
  private pendingRequests = new Map<string, RequestHandler>();
  private changeBuffer: any[] = [];
  private onChangesCallback: ((changes: any[]) => void) | null = null;
  /** Latest version from npm registry (checked on startup) */
  latestVersion: string | null = null;
  /** Current installed version */
  currentVersion: string;

  constructor(port: number = 9223) {
    this.port = port;
    this.currentVersion = "__VERSION__"; // replaced at build time, fallback below
    this.checkForUpdates();
  }

  /** Check npm registry for the latest version (non-blocking) */
  private async checkForUpdates() {
    // Test override — skip registry fetch
    const testVersion = process.env.TUNA_TEST_LATEST_VERSION;
    if (testVersion) {
      this.latestVersion = testVersion;
      console.error(`[Tuna MCP] Update check: using test version ${testVersion}`);
      return;
    }

    try {
      // Read current version from package.json if __VERSION__ wasn't replaced
      if (this.currentVersion === "__VERSION__") {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        try {
          // dist/bridge.js → ../package.json (package root)
          const pkg = require("../package.json");
          this.currentVersion = pkg.version;
        } catch {
          this.currentVersion = "0.0.0";
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("https://registry.npmjs.org/@suryanewa%2ftuna/latest", {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as { version?: string };
        if (data.version) {
          this.latestVersion = data.version;
          if (data.version !== this.currentVersion) {
            console.error(`[Tuna MCP] Update available: ${this.currentVersion} → ${data.version}`);
          }
        }
      }
    } catch {
      // Network error or timeout — silently ignore
    }
  }

  /** Start the WebSocket server */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ host: this.host, port: this.port }, () => {
        console.error(`[Tuna MCP] WebSocket bridge listening on ${this.host}:${this.port}`);
        resolve();
      });

      this.wss.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          // Try next port
          this.port++;
          if (this.port > 9232) {
            reject(new Error("No available ports in range 9223-9232"));
            return;
          }
          this.wss?.close();
          this.start().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
        // Require a handshake before accepting the connection.
        // The browser overlay sends { method: "handshake", params: { client: "tuna-overlay" } }
        // as its first message. Connections that don't handshake within 5s are closed.
        // This prevents non-overlay clients (e.g. ChatGPT desktop, other tools)
        // from hijacking the WebSocket slot.
        let verified = false;
        const handshakeTimeout = setTimeout(() => {
          if (!verified) {
            console.error("[Tuna MCP] Closing unverified connection (no handshake)");
            ws.close();
          }
        }, 5000);

        ws.on("message", (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());

            // Handle handshake
            if (!verified && msg.method === "handshake" && msg.params?.client === "tuna-overlay") {
              verified = true;
              clearTimeout(handshakeTimeout);
              console.error("[Tuna MCP] Browser overlay connected (verified)");

              // Replace existing client
              if (this.client && this.client !== ws) {
                this.client.close();
              }
              this.client = ws;

              ws.send(JSON.stringify({ id: msg.id, result: {
                ok: true,
                ...(this.latestVersion ? { latestVersion: this.latestVersion } : {}),
              } }));
              return;
            }

            // Reject messages from unverified connections
            if (!verified) {
              ws.close();
              clearTimeout(handshakeTimeout);
              return;
            }

            // Response to our request
            if (msg.id && this.pendingRequests.has(msg.id)) {
              const handler = this.pendingRequests.get(msg.id)!;
              this.pendingRequests.delete(msg.id);
              if (msg.error) {
                handler(new Error(typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)));
              } else {
                handler(msg.result);
              }
              return;
            }

            // Push from browser (e.g., pushChanges)
            if (msg.method === "pushChanges" && msg.params?.changes) {
              this.changeBuffer.push(...msg.params.changes);
              this.onChangesCallback?.(msg.params.changes);
              // Acknowledge
              ws.send(JSON.stringify({ id: msg.id, result: { ok: true } }));
            }
          } catch (err) {
            console.error("[Tuna MCP] Failed to parse message:", err);
          }
        });

        ws.on("close", () => {
          clearTimeout(handshakeTimeout);
          if (verified) {
            console.error("[Tuna MCP] Browser overlay disconnected");
            if (this.client === ws) this.client = null;
          }
        });
      });
    });
  }

  /** Send a request to the browser overlay and wait for response */
  async request(method: string, params?: any): Promise<any> {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      throw new Error("Browser overlay is not connected");
    }

    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 10000);

      this.pendingRequests.set(id, (result) => {
        clearTimeout(timeout);
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });

      this.client!.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Get and clear buffered changes */
  consumeChanges(): any[] {
    const changes = [...this.changeBuffer];
    this.changeBuffer = [];
    return changes;
  }

  /** Get buffered changes without clearing */
  peekChanges(): any[] {
    return [...this.changeBuffer];
  }

  /** Register callback for new changes */
  onChanges(callback: (changes: any[]) => void) {
    this.onChangesCallback = callback;
  }

  /** Check if browser overlay is connected */
  get connected(): boolean {
    return this.client?.readyState === WebSocket.OPEN;
  }

  /** Stop the WebSocket server */
  stop() {
    this.wss?.close();
    this.client = null;
    for (const [id, handler] of this.pendingRequests) {
      handler(new Error("Bridge stopped"));
    }
    this.pendingRequests.clear();
  }
}
