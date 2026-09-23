import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";

// Load .env BEFORE reading RATE_LIMIT_* etc. below (index.ts requires this
// module first, so a config() here guarantees env vars exist at that point).
dotenv.config();

const app = express();

// Security hardening.
app.use(helmet());

// CORS restricted to configured origins (no-origin requests allowed).
const corsOrigins = (
  process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "32kb" }));

// Fail fast when CORS rejects a request.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === "Not allowed by CORS") {
    res.status(403).json({ message: "Not allowed by CORS" });
    return;
  }
  next(err);
});

// Global budget for the user service (default 500 req / 15 min).
const globalWindowMs = Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? 15 * 60 * 1000);
const globalMax = Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 500);
app.use(
  rateLimit({
    windowMs: globalWindowMs,
    max: globalMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  })
);

// Tight budget on credential endpoints to slow automated guessing/resource
// flooding (default 20 req / 10 min per IP).
const authWindowMs = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 10 * 60 * 1000);
const authMax = Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: authWindowMs,
    max: authMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts, please try again later." },
  })
);

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[user-service] unhandled error:", err instanceof Error ? err.stack : err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
