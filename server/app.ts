// Must be the first import: ES module imports are hoisted and evaluated
// before this file's own top-level code, so a plain `import dotenv from
// "dotenv"` followed by a later `dotenv.config()` call would run AFTER
// downstream imports (like ./routes/summarize -> ./services/claudeClient)
// have already read process.env at their own module scope. The "dotenv/config"
// side-effect import loads .env immediately as part of the import itself, so
// it must be listed first to run before anything else does.
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import summarizeRouter from "./routes/summarize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

app.use("/api/summarize", summarizeRouter);

const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));

// SPA fallback: any request not already handled above (API routes or a
// static file) gets index.html, so client-side routing/refresh works.
app.use((_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Global error handler — MUST be registered last (an Express error handler is
// identified purely by having 4 parameters, and only catches errors from
// middleware/routes registered before it). Without this, body-parser errors
// (malformed JSON, oversized payloads) fall through to Express's default
// handler, which returns an HTML page with a full stack trace and absolute
// filesystem paths — a real information-disclosure gap found during a
// security review. This never echoes the underlying error's message or stack
// to the client, regardless of NODE_ENV — the fix does not rely on the
// platform happening to set NODE_ENV=production.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const type = (err as { type?: string } | null)?.type;

    if (type === "entity.too.large") {
      console.error("Request body too large:", err);
      res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Meeting notes are too long. Please shorten and try again.",
        },
      });
      return;
    }

    if (type === "entity.parse.failed" || err instanceof SyntaxError) {
      console.error("Malformed request body:", err);
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request.",
        },
      });
      return;
    }

    console.error("Unhandled error:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
  },
);

export default app;
