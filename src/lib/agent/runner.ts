import type { ToolName } from "./catalog";
import { executeTool, toolSpecs } from "./tools";
import type { Message, ModelProvider, RunEvent, ToolResultBlock } from "./types";

export type RunOptions = {
  provider: ModelProvider;
  systemPrompt: string;
  tools: readonly ToolName[];
  input: string;
  maxSteps: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Injected in tests to keep tools offline. */
  toolFetch?: typeof fetch;
  now?: () => number;
};

/**
 * The agent loop: ask the model, run any tools it calls, feed results back, repeat
 * until it answers without tools or the step budget runs out.
 *
 * Yields events as they happen so callers can stream them and persist them.
 * The final event is always `done` or `error`.
 */
export async function* runAgent(opts: RunOptions): AsyncGenerator<RunEvent> {
  const now = opts.now ?? Date.now;
  const started = now();
  const specs = toolSpecs(opts.tools);
  const messages: Message[] = [{ role: "user", content: opts.input }];
  const usage = { inputTokens: 0, outputTokens: 0 };

  try {
    for (let step = 1; step <= opts.maxSteps; step++) {
      opts.signal?.throwIfAborted();
      yield { type: "step", step };

      const response = await opts.provider.complete({
        system: opts.systemPrompt,
        messages,
        tools: specs,
        maxTokens: opts.maxTokens ?? 1024,
        signal: opts.signal,
      });
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      messages.push({ role: "assistant", content: response.content });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) yield { type: "text", text };

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0 || response.stopReason !== "tool_use") {
        yield { type: "done", output: text, usage, durationMs: now() - started };
        return;
      }

      const results: ToolResultBlock[] = [];
      for (const call of toolUses) {
        yield { type: "tool_call", id: call.id, name: call.name, input: call.input };
        const outcome = await executeTool(call.name, call.input, opts.tools, {
          signal: opts.signal,
          fetch: opts.toolFetch,
        });
        yield { type: "tool_result", id: call.id, name: call.name, output: outcome.output, isError: outcome.isError };
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: outcome.output,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: results });
    }

    yield {
      type: "error",
      message: `The agent used all ${opts.maxSteps} steps without finishing. Raise the step limit or narrow the task.`,
    };
  } catch (err) {
    if (opts.signal?.aborted) {
      yield { type: "error", message: "Run cancelled." };
      return;
    }
    yield { type: "error", message: err instanceof Error ? err.message : "The run failed unexpectedly." };
  }
}
