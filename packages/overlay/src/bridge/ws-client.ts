/**
 * WebSocket client for communicating with the MCP server.
 *
 * The browser overlay connects to the local MCP server via WebSocket.
 * The MCP server bridges these messages to AI tools via stdio.
 */

import type { ElementChange } from "../types";

type MessageHandler = (method: string, params: any) => Promise<any>;

declare const __TUNA_VERSION__: string;

export class BridgeClient {
  private ws: WebSocket | null = null;
  private port: number;
  private handlers: MessageHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private requestId = 0;
  private _connected = false;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 60000;
  /** If set, a newer version is available */
  updateAvailable: { current: string; latest: string } | null = null;
  private onUpdateCallback: ((info: { current: string; latest: string }) => void) | null = null;

  constructor(port: number = 9223) {
    this.port = port;
  }

  get connected() {
    return this._connected;
  }

  /** Register a handler for incoming requests from the MCP server */
  onRequest(handler: MessageHandler) {
    this.handlers = handler;
  }

  /** Register a callback for when an update is available */
  onUpdate(callback: (info: { current: string; latest: string }) => void) {
    this.onUpdateCallback = callback;
    // Fire immediately if we already have update info
    if (this.updateAvailable) callback(this.updateAvailable);
  }

  /** Connect to the MCP server */
  connect() {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`);

      this.ws.onopen = () => {
        this.reconnectDelay = 3000;
        // Send handshake to identify ourselves as the browser overlay.
        // The server only accepts connections that complete this handshake,
        // preventing non-overlay clients (e.g. ChatGPT desktop, other tools)
        // from hijacking the WebSocket slot.
        const handshakeId = String(++this.requestId);
        const timer = setTimeout(() => {
          this.pendingRequests.delete(handshakeId);
          // Fallback: if the server doesn't respond to the handshake
          // (older server version), still mark as connected so the
          // bridge is usable.
          if (!this._connected) {
            this._connected = true;
            console.log("[Tuna] Connected to MCP server (handshake not acknowledged, assuming compatible)");
          }
        }, 3000);
        this.pendingRequests.set(handshakeId, {
          resolve: (result: any) => {
            this._connected = true;
            console.log("[Tuna] Connected to MCP server (verified)");
            // Check for update info — compare against overlay's own version
            if (result?.latestVersion) {
              const overlayVersion = typeof __TUNA_VERSION__ === "string" ? __TUNA_VERSION__ : "0.0.0";
              if (result.latestVersion !== overlayVersion && this.isNewer(result.latestVersion, overlayVersion)) {
                this.updateAvailable = { current: overlayVersion, latest: result.latestVersion };
                this.onUpdateCallback?.(this.updateAvailable);
              }
            }
          },
          reject: () => {
            // Server rejected handshake — still usable but log warning
            this._connected = true;
            console.warn("[Tuna] Handshake rejected, connected in fallback mode");
          },
          timer,
        });
        this.ws?.send(JSON.stringify({ id: handshakeId, method: "handshake", params: { client: "tuna-overlay" } }));
      };

      this.ws.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          console.error("[Tuna] Failed to parse message:", err);
          return;
        }

        // Response to our request
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
          return;
        }

        // Incoming request from MCP server
        if (msg.method && this.handlers) {
          try {
            const result = await this.handlers(msg.method, msg.params);
            // Use a replacer to skip non-serializable values (DOM nodes, functions)
            const json = JSON.stringify({ id: msg.id, result }, (_key, value) => {
              if (value instanceof Element || value instanceof Node) return undefined;
              if (typeof value === "function") return undefined;
              return value;
            });
            this.ws?.send(json);
          } catch (err: any) {
            this.ws?.send(JSON.stringify({ id: msg.id, error: err.message }));
          }
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.ws = null;
        // Reconnect with exponential backoff
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      // Server not running — will retry via reconnect
    }
  }

  /** Send pending changes to the MCP server */
  async sendChanges(changes: ElementChange[]): Promise<void> {
    await this.request("pushChanges", { changes });
  }

  /** Send a request to the MCP server and wait for response */
  private request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to MCP server"));
        return;
      }

      const id = String(++this.requestId);
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timed out"));
        }
      }, 10000);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Simple semver comparison: is `a` newer than `b`? */
  private isNewer(a: string, b: string): boolean {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
  }

  /** Disconnect and clean up */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect from onclose handler
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    // Reject all pending requests so callers don't hang
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Disconnected"));
    }
    this.pendingRequests.clear();
  }
}
