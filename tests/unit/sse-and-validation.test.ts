import { describe, expect, it } from "vitest";
import { createSSEParser, encodeSSE } from "@/lib/sse";
import { agentSchema, fieldErrors, signUpSchema } from "@/lib/validation";

describe("SSE framing", () => {
  it("round-trips events split across arbitrary chunk boundaries", () => {
    const events = [{ type: "text", text: "line one\nline two" }, { type: "done" }, { type: "x", n: 3 }];
    const wire = events.map(encodeSSE).join("");
    const parser = createSSEParser();
    const received: unknown[] = [];
    for (let i = 0; i < wire.length; i += 7) received.push(...parser.push(wire.slice(i, i + 7)));
    expect(received).toEqual(events);
  });

  it("handles CRLF line endings", () => {
    const parser = createSSEParser();
    expect(parser.push('data: {"a":1}\r\n\r\n')).toEqual([{ a: 1 }]);
  });
});

describe("validation", () => {
  it("normalises email and enforces password length", () => {
    const ok = signUpSchema.safeParse({ name: "Ada", email: "  Ada@Example.COM ", password: "long-enough-pw" });
    expect(ok.success && ok.data.email).toBe("ada@example.com");

    const bad = signUpSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrors(bad.error)).toEqual({ password: "Use at least 10 characters." });
  });

  it("accepts known tools and coerces the step limit", () => {
    const parsed = agentSchema.parse({
      name: "Quoter",
      systemPrompt: "Price jobs carefully.",
      tools: ["calculator"],
      maxSteps: "4",
    });
    expect(parsed).toMatchObject({ tools: ["calculator"], maxSteps: 4, description: "" });
  });

  it("rejects unknown tools and out-of-range limits", () => {
    const result = agentSchema.safeParse({
      name: "x",
      systemPrompt: "Do something useful.",
      tools: ["shell"],
      maxSteps: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(["maxSteps", "tools"]);
  });
});
