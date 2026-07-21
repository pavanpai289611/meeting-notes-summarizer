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

export default app;
