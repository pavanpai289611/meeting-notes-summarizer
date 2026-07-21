import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export interface ActionItem {
  task: string;
  owner: string;
}

export interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}

const SummarySchema = z.object({
  keyDiscussionPoints: z.array(z.string()),
  decisionsMade: z.array(z.string()),
  actionItems: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
    }),
  ),
});

// Constructed lazily (on first call) rather than at module load, so this
// never races against whatever loads .env into process.env at server
// startup — the client only needs ANTHROPIC_API_KEY by the time a request
// actually comes in, not at import time.
let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30_000, // milliseconds
    });
  }
  return client;
}

const SYSTEM_PROMPT = `You are an assistant that extracts a structured summary from raw meeting notes or transcripts.

Extract three things:
- keyDiscussionPoints: the main topics that were discussed.
- decisionsMade: any concrete decisions the group reached.
- actionItems: concrete follow-up tasks. For each, include an "owner" — the exact name of the
  person responsible if one is explicitly mentioned in the text, or the literal string
  "Unassigned" if no owner is stated. Never guess or infer an owner that isn't stated.

If a category has no items, return an empty array for it rather than omitting the field.`;

export async function summarizeTranscript(transcript: string): Promise<Summary> {
  const response = await getClient().messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
    output_config: {
      format: zodOutputFormat(SummarySchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude response did not include a parsed summary.");
  }

  return response.parsed_output;
}
