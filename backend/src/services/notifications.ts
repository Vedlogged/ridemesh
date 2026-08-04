/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface NotificationPayload {
  type: string;
  data: any;
}

export class NotificationService {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();

  public static initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New client connected to Notification WebSocket");
      this.clients.add(ws);

      ws.send(JSON.stringify({
        type: "welcome",
        data: { message: "Connected to RideMesh X Live Notification Feed" }
      }));

      ws.on("close", () => {
        console.log("Client disconnected from Notification WebSocket");
        this.clients.delete(ws);
      });

      ws.on("error", (err) => {
        console.error("WebSocket Client Error:", err);
        this.clients.delete(ws);
      });
    });
  }

  public static broadcast(type: string, data: any): void {
    const payload: NotificationPayload = { type, data };
    const rawPayload = JSON.stringify(payload);

    console.log(`Broadcasting WebSocket event: [${type}]`);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(rawPayload);
        } catch (e) {
          console.error("Failed to push notification to client:", e);
        }
      }
    }
  }
}
