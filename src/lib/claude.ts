import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-8";

/** True when a real Claude key is configured and demo mode is not forced. */
export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.FORCE_DEMO_MODE !== "1";
}

export function activeModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Single-turn completion with a system prompt. Returns plain text. */
export async function complete(
  system: string,
  user: string,
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const res = await getClient().messages.create({
    model: activeModel(),
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Multi-turn chat completion. */
export async function chat(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const res = await getClient().messages.create({
    model: activeModel(),
    max_tokens: opts.maxTokens ?? 2048,
    system,
    messages,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Extract the first JSON object from a model response (tolerates fences/prose). */
export function extractJson<T>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
