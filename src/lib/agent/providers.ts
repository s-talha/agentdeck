import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  Message,
  ModelProvider,
  ToolResultBlock,
} from "./types";

export class ProviderError extends Error {}

// ---------------------------------------------------------------------------
// Anthropic (real model). Plain fetch against the Messages API keeps the dependency surface small.
// ---------------------------------------------------------------------------

export class AnthropicProvider implements ModelProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
        ...(req.tools.length > 0 ? { tools: req.tools } : {}),
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body.error?.message ?? detail;
      } catch {
        // Keep statusText.
      }
      throw new ProviderError(`Model request failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      stop_reason: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content: AssistantBlock[] = [];
    for (const block of data.content) {
      if (block.type === "text" && typeof block.text === "string") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use" && block.id && block.name) {
        content.push({ type: "tool_use", id: block.id, name: block.name, input: block.input ?? {} });
      }
    }

    return {
      content,
      stopReason: data.stop_reason,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Offline demo model. Deterministic, so the app works without an API key and e2e tests are stable.
// ---------------------------------------------------------------------------

const estimateTokens = (chars: number) => Math.max(1, Math.ceil(chars / 4));

/** Finds the longest run of arithmetic in free text, e.g. "What is 12 * (3 + 4)?" -> "12 * (3 + 4)". */
export function extractExpression(text: string): string | null {
  const candidates = text.match(/[-+*/%^().\d\s]+/g) ?? [];
  const valid = candidates
    .map((c) => c.trim())
    .filter((c) => /\d/.test(c) && /\d\s*[-+*/%^]\s*[\d(]/.test(c));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (b.length > a.length ? b : a));
}

export class DemoProvider implements ModelProvider {
  readonly model = "demo-offline";

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const last = req.messages.at(-1);
    const allowed = new Set(req.tools.map((t) => t.name));
    const turn = req.messages.length;
    let content: AssistantBlock[];

    if (last?.role === "user" && Array.isArray(last.content)) {
      content = [{ type: "text", text: this.summarize(last.content, req.messages) }];
    } else {
      const prompt = last?.role === "user" && typeof last.content === "string" ? last.content : "";
      content = this.plan(prompt, allowed, turn);
    }

    const stopReason = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
    const inputChars = req.system.length + JSON.stringify(req.messages).length;
    const outputChars = JSON.stringify(content).length;
    // Small delay so the streamed trace is visible in demos.
    await new Promise((r) => setTimeout(r, 250));
    return {
      content,
      stopReason,
      usage: { inputTokens: estimateTokens(inputChars), outputTokens: estimateTokens(outputChars) },
    };
  }

  private plan(prompt: string, allowed: Set<string>, turn: number): AssistantBlock[] {
    const id = `toolu_demo_${turn}`;
    const expression = extractExpression(prompt);
    if (expression && allowed.has("calculator")) {
      return [
        { type: "text", text: "I'll work that out with the calculator." },
        { type: "tool_use", id, name: "calculator", input: { expression } },
      ];
    }
    if (/\b(time|date|today|clock)\b/i.test(prompt) && allowed.has("current_time")) {
      const zone = /\b([A-Z][a-z]+\/[A-Z][A-Za-z_]+)\b/.exec(prompt)?.[1] ?? "UTC";
      return [{ type: "tool_use", id, name: "current_time", input: { timeZone: zone } }];
    }
    const topic = /\b(?:who|what)\s+(?:is|was|are|were)\s+(.+?)[?.!]*$/i.exec(prompt.trim())?.[1];
    if (topic && allowed.has("wikipedia_summary")) {
      return [
        { type: "text", text: `Let me look up "${topic}" on Wikipedia.` },
        { type: "tool_use", id, name: "wikipedia_summary", input: { title: topic } },
      ];
    }
    return [
      {
        type: "text",
        text:
          "This workspace is running the offline demo model, which can only route arithmetic, time and \"who/what is\" questions to tools. Add an ANTHROPIC_API_KEY to get full answers.",
      },
    ];
  }

  private summarize(results: ToolResultBlock[], history: Message[]): string {
    const calls = new Map<string, string>();
    for (const message of history) {
      if (message.role !== "assistant") continue;
      for (const block of message.content) if (block.type === "tool_use") calls.set(block.id, block.name);
    }
    return results
      .map((r) => {
        if (r.is_error) return `The ${calls.get(r.tool_use_id) ?? "tool"} reported a problem: ${r.content}`;
        switch (calls.get(r.tool_use_id)) {
          case "calculator":
            return `The answer is ${r.content}.`;
          case "current_time":
            return `It is ${r.content}.`;
          default:
            return `Here's what I found:\n\n${r.content}`;
        }
      })
      .join("\n\n");
  }
}

export function getProvider(): ModelProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  return new DemoProvider();
}
