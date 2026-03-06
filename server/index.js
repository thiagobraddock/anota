import "dotenv/config";
import express from "express";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pool, { initDB } from "./db.js";
import notesRouter from "./routes/notes.js";
import authRouter from "./routes/auth.js";
import { setupWebSocket } from "./websocket.js";
import "./middleware/passport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

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

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
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

async function start() {
  try {
    await initDB();

    // Create HTTP server
    const server = createServer(app);

    // Setup WebSocket for real-time collaboration
    setupWebSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
