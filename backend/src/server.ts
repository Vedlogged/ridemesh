import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as dotenv from "dotenv";
import * as Sentry from "@sentry/node";

// Load configuration
dotenv.config();

import { connectDB } from "./config/db";
import { NotificationService } from "./services/notifications";
import { startEventListener } from "./listener";
import apiRouter from "./routes/api";

const PORT = process.env.PORT || 5001;

// 1. Initialize Sentry Monitoring (if DSN provided)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  console.log("✓ Sentry performance monitoring initialized!");
}

const app = express();
const server = createServer(app);

// 2. Configure Global Middlewares
app.use(cors({ origin: "*" })); // Allow frontend connections
app.use(express.json());

// 3. Configure API Rate Limiting (Production Safety)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use("/api", limiter);

// Request Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[HTTP] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// 4. Register Routes
app.use("/api", apiRouter);

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "online",
    name: "RideMesh X API Backend Engine",
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
    version: "1.0.0"
  });
});

// 5. Error handling middlewares
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred"
  });
});

// 6. Bootstrap Database, WebSockets, and Event Listener
async function bootstrap() {
  // Connect database
  await connectDB();

  // Initialize WebSocket Notifications
  NotificationService.initialize(server);
  console.log("✓ Live notification service listening on WebSockets upgrade");

  // Start HTTP Server
  server.listen(PORT, () => {
    console.log(`🚀 RideMesh X Backend running on http://localhost:${PORT}`);
  });

  // Start Stellar ledger event indexer
  await startEventListener();
}

bootstrap().catch(err => {
  console.error("Critical Server Bootstrap Failure:", err);
});
