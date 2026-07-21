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
