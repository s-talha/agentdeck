import { describe, expect, it } from "vitest";
import { DemoProvider, extractExpression } from "@/lib/agent/providers";
import { runAgent, type RunOptions } from "@/lib/agent/runner";
import type { CompletionRequest, CompletionResponse, ModelProvider, RunEvent } from "@/lib/agent/types";

async function collect(opts: RunOptions) {
  const events: RunEvent[] = [];
  for await (const e of runAgent(opts)) events.push(e);
  return events;
}

/** Plays back a fixed list of responses and records what it was asked. */
class ScriptedProvider implements ModelProvider {
  readonly model = "scripted";
  readonly requests: CompletionRequest[] = [];
  constructor(private readonly script: CompletionResponse[]) {}
  async complete(req: CompletionRequest) {
    this.requests.push(structuredClone({ ...req, signal: undefined }));
    const next = this.script.shift();
    if (!next) throw new Error("Script exhausted");
    return next;
  }
}

const usage = { inputTokens: 10, outputTokens: 5 };

describe("runAgent", () => {
  it("calls a tool, feeds the result back, and finishes", async () => {
    const provider = new ScriptedProvider([
      {
        content: [{ type: "tool_use", id: "t1", name: "calculator", input: { expression: "6 * 7" } }],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "It's 42." }], stopReason: "end_turn", usage },
    ]);

    const events = await collect({
      provider,
      systemPrompt: "Be precise.",
      tools: ["calculator"],
      input: "6 times 7?",
      maxSteps: 4,
    });

    expect(events.map((e) => e.type)).toEqual(["step", "tool_call", "tool_result", "step", "text", "done"]);
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({ output: "42", isError: false });
    expect(events.at(-1)).toMatchObject({ type: "done", output: "It's 42.", usage: { inputTokens: 20, outputTokens: 10 } });

    // The second request carries the tool result back to the model.
    const secondTurn = provider.requests[1]!.messages.at(-1);
    expect(secondTurn).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "42" }],
    });
    expect(provider.requests[0]!.tools.map((t) => t.name)).toEqual(["calculator"]);
  });

  it("refuses tools the agent was not given", async () => {
    const provider = new ScriptedProvider([
      {
        content: [{ type: "tool_use", id: "t1", name: "wikipedia_summary", input: { title: "x" } }],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "OK." }], stopReason: "end_turn", usage },
    ]);
    const events = await collect({ provider, systemPrompt: "s", tools: ["calculator"], input: "hi", maxSteps: 3 });
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      isError: true,
      output: 'Tool "wikipedia_summary" is not enabled for this agent.',
    });
  });

  it("reports invalid tool input to the model instead of crashing", async () => {
    const provider = new ScriptedProvider([
      { content: [{ type: "tool_use", id: "t1", name: "calculator", input: {} }], stopReason: "tool_use", usage },
      { content: [{ type: "text", text: "Sorry." }], stopReason: "end_turn", usage },
    ]);
    const events = await collect({ provider, systemPrompt: "s", tools: ["calculator"], input: "?", maxSteps: 3 });
    const result = events.find((e) => e.type === "tool_result");
    expect(result).toMatchObject({ isError: true });
    expect(result && "output" in result && result.output).toContain("expression");
  });

  it("stops at the step limit", async () => {
    const loop: CompletionResponse = {
      content: [{ type: "tool_use", id: "t", name: "calculator", input: { expression: "1+1" } }],
      stopReason: "tool_use",
      usage,
    };
    const provider = new ScriptedProvider([loop, loop, loop]);
    const events = await collect({ provider, systemPrompt: "s", tools: ["calculator"], input: "loop", maxSteps: 2 });
    expect(events.filter((e) => e.type === "step")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "error", message: expect.stringContaining("all 2 steps") });
  });

  it("turns provider failures into an error event", async () => {
    const provider = new ScriptedProvider([]);
    const events = await collect({ provider, systemPrompt: "s", tools: [], input: "x", maxSteps: 2 });
    expect(events.at(-1)).toEqual({ type: "error", message: "Script exhausted" });
  });

  it("reports cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await collect({
      provider: new ScriptedProvider([]),
      systemPrompt: "s",
      tools: [],
      input: "x",
      maxSteps: 2,
      signal: controller.signal,
    });
    expect(events).toEqual([{ type: "error", message: "Run cancelled." }]);
  });
});

describe("DemoProvider", () => {
  it("answers arithmetic end to end through the calculator", async () => {
    const events = await collect({
      provider: new DemoProvider(),
      systemPrompt: "s",
      tools: ["calculator"],
      input: "What is 12 * (3 + 4)?",
      maxSteps: 4,
    });
    expect(events.at(-1)).toMatchObject({ type: "done", output: "The answer is 84." });
  });

  it("uses Wikipedia for who/what questions", async () => {
    const fakeFetch = (async () =>
      Response.json({
        title: "Grace Hopper",
        extract: "Grace Hopper was an American computer scientist.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Grace_Hopper" } },
      })) as typeof fetch;

    const events = await collect({
      provider: new DemoProvider(),
      systemPrompt: "s",
      tools: ["wikipedia_summary"],
      input: "Who is Grace Hopper?",
      maxSteps: 4,
      toolFetch: fakeFetch,
    });
    expect(events.find((e) => e.type === "tool_call")).toMatchObject({ input: { title: "Grace Hopper" } });
    expect(events.at(-1)).toMatchObject({ type: "done", output: expect.stringContaining("American computer scientist") });
  });

  it("extracts arithmetic from prose", () => {
    expect(extractExpression("What is 12 * (3 + 4)?")).toBe("12 * (3 + 4)");
    expect(extractExpression("Price 38.5 * 950 please")).toBe("38.5 * 950");
    expect(extractExpression("What year is 2026?")).toBeNull();
  });
});
