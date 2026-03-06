/**
 * WebSocket bridge between the browser overlay and the MCP server.
 *
 * The browser overlay connects via ws://localhost:{port}/ws.
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
  private requestId = 0;
  private pendingRequests = new Map<string, RequestHandler>();
  private changeBuffer: any[] = [];
  private onChangesCallback: ((changes: any[]) => void) | null = null;

  constructor(port: number = 9223) {
    this.port = port;
  }

  /** Start the WebSocket server */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port }, () => {
        console.error(`[Composer MCP] WebSocket bridge listening on port ${this.port}`);
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
        console.error("[Composer MCP] Browser overlay connected");
        this.client = ws;

        ws.on("message", (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());

            // Response to our request
            if (msg.id && this.pendingRequests.has(msg.id)) {
              const handler = this.pendingRequests.get(msg.id)!;
              this.pendingRequests.delete(msg.id);
              handler(msg.result ?? msg.error);
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
            console.error("[Composer MCP] Failed to parse message:", err);
          }
        });

        ws.on("close", () => {
          console.error("[Composer MCP] Browser overlay disconnected");
          if (this.client === ws) this.client = null;
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
        if (result instanceof Error || (result && result.error)) {
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
    this.pendingRequests.clear();
  }
}
