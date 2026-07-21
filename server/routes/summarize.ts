import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import { Router } from "express";
import { summarizeTranscript } from "../services/claudeClient";

const router = Router();

router.post("/", async (req, res) => {
  const { transcript } = req.body ?? {};

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    res.status(400).json({
      error: {
        code: "EMPTY_INPUT",
        message: "Please paste some meeting notes before summarizing.",
      },
    });
    return;
  }

  try {
    const summary = await summarizeTranscript(transcript);
    res.status(200).json({ summary });
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) {
      console.error("Summarization timed out:", error);
      res.status(504).json({
        error: {
          code: "TIMEOUT",
          message: "Summarization is taking too long. Please try again.",
        },
      });
      return;
    }

    console.error("Summarization failed:", error);
    res.status(502).json({
      error: {
        code: "SUMMARIZATION_FAILED",
        message: "Something went wrong generating the summary. Please try again.",
      },
    });
  }
});

export default router;
