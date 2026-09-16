import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pool, { checkDBHealth, getDBStatus, initDB } from "./db.js";
import notesRouter from "./routes/notes.js";
import authRouter from "./routes/auth.js";
import { setupWebSocket } from "./websocket.js";
import { deviceIdMiddleware } from "./middleware/deviceId.js";
import "./middleware/passport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(deviceIdMiddleware);

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

async function handleHealthCheck(_req, res) {
  const db = await checkDBHealth();
  const ready = db.initialized && db.reachable && !db.initializing;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    db: {
      ready,
      reachable: db.reachable,
      initialized: db.initialized,
      initializing: db.initializing,
      lastReadyAt: db.lastReadyAt,
      lastHealthCheckAt: db.lastHealthCheckAt,
      errorCode: ready ? null : db.lastError?.code || null,
    },
  });
}

app.get("/api/health", handleHealthCheck);
app.get("/api/ready", handleHealthCheck);
app.use("/api/notes", notesRouter);
app.use("/api/auth", authRouter);

// Serve static files from React build
app.use(express.static(join(__dirname, "public")));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(join(__dirname, "public", "index.html"));
});

const DB_BACKGROUND_RETRY_MS = 15000;

// Keeps retrying initDB in the background instead of crashing the process.
// A crash makes Railway restart the container, which creates the exact
// "connection refused" window users hit as a 404 on their first request.
// Staying up and reporting "degraded" on /api/health is more resilient to a
// transient Postgres restart than dying and hoping the next boot is luckier.
function retryDBInBackground() {
  const timer = setInterval(async () => {
    try {
      await initDB();
      console.log("✅ Database recovered", getDBStatus());
      clearInterval(timer);
    } catch (err) {
      console.warn(
        "Database still unavailable, will retry:",
        err.message,
        JSON.stringify(getDBStatus().lastError),
      );
    }
  }, DB_BACKGROUND_RETRY_MS);
}

async function start() {
  try {
    await initDB();
    console.log("✅ Database ready", getDBStatus());
  } catch (err) {
    console.error(
      "Database not ready at startup, continuing in degraded mode:",
      err.message,
      JSON.stringify(getDBStatus().lastError),
    );
    retryDBInBackground();
  }

  // Create HTTP server
  const server = createServer(app);

  // Setup WebSocket for real-time collaboration
  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start();
