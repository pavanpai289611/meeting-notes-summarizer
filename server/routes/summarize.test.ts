import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { summarizeTranscript } from "../services/claudeClient";

vi.mock("../services/claudeClient");

const mockedSummarizeTranscript = vi.mocked(summarizeTranscript);

describe("POST /api/summarize", () => {
  beforeEach(() => {
    mockedSummarizeTranscript.mockReset();
  });

  it("returns 400 EMPTY_INPUT for an empty or whitespace-only transcript and never calls Claude", async () => {
    const emptyResponse = await request(app)
      .post("/api/summarize")
      .send({ transcript: "" });
    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.error.code).toBe("EMPTY_INPUT");

    const whitespaceResponse = await request(app)
      .post("/api/summarize")
      .send({ transcript: "   " });
    expect(whitespaceResponse.status).toBe(400);
    expect(whitespaceResponse.body.error.code).toBe("EMPTY_INPUT");

    expect(mockedSummarizeTranscript).not.toHaveBeenCalled();
  });

  it("returns 200 with the summary on success", async () => {
    const sampleSummary = {
      keyDiscussionPoints: ["Point A"],
      decisionsMade: ["Decision A"],
      actionItems: [{ task: "Task A", owner: "Alice" }],
    };
    mockedSummarizeTranscript.mockResolvedValue(sampleSummary);

    const response = await request(app)
      .post("/api/summarize")
      .send({ transcript: "A real transcript" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ summary: sampleSummary });
  });

  it("returns 502 SUMMARIZATION_FAILED when the Claude call fails generically", async () => {
    mockedSummarizeTranscript.mockRejectedValue(new Error("boom"));

    const response = await request(app)
      .post("/api/summarize")
      .send({ transcript: "A real transcript" });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("SUMMARIZATION_FAILED");
  });

  it("returns 504 TIMEOUT when the Claude call times out", async () => {
    mockedSummarizeTranscript.mockRejectedValue(
      new APIConnectionTimeoutError({ message: "Request timed out." }),
    );

    const response = await request(app)
      .post("/api/summarize")
      .send({ transcript: "A real transcript" });

    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe("TIMEOUT");
  });
});
