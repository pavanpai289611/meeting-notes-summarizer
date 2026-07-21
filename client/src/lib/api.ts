import type { Summary } from "../types";

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "EMPTY_INPUT":
        return "Please paste some meeting notes before summarizing.";
      case "TIMEOUT":
        return "Summarization is taking too long. Please try again in a moment.";
      case "SUMMARIZATION_FAILED":
        return "Something went wrong generating the summary. Please try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  // Not an ApiError — the request never got a response to parse at all
  // (fetch itself rejected, e.g. the server is unreachable) or something
  // failed in an unexpected shape. Never surface the raw error here.
  return "Couldn't reach the server. Check your connection and try again.";
}

export async function summarize(transcript: string): Promise<Summary> {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const body = (await response.json()) as ErrorEnvelope;
    throw new ApiError(body.error.code, body.error.message);
  }

  const body = (await response.json()) as { summary: Summary };
  return body.summary;
}
