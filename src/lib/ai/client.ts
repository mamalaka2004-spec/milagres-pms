import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  _client = new OpenAI({ apiKey });
  return _client;
}

/** Default model — gpt-4o-mini balances cost and tool-calling quality. */
export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
