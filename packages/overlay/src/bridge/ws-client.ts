/**
 * WebSocket client for communicating with the MCP server.
 *
 * The browser overlay connects to the local MCP server via WebSocket.
 * The MCP server bridges these messages to AI tools via stdio.
 */

import type { ElementChange } from "../types";

type MessageHandler = (method: string, params: any) => Promise<any>;

export class BridgeClient {
  private ws: WebSocket | null = null;
  private port: number;
  private handlers: MessageHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private requestId = 0;
  private _connected = false;

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

  /** Connect to the MCP server */
  connect() {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/ws`);

      this.ws.onopen = () => {
        this._connected = true;
        console.log("[Composer] Connected to MCP server");
      };

      this.ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        // Response to our request
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
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
        // Reconnect after 3 seconds
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
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
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timed out"));
        }
      }, 10000);
    });
  }

  /** Disconnect and clean up */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.pendingRequests.clear();
  }
}
