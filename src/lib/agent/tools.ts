import { z } from "zod";
import { CalculatorError, evaluate, formatNumber } from "./calculator";
import { TOOL_CATALOG, type ToolName } from "./catalog";
import type { ToolSpec } from "./types";

/** Thrown by a tool when the model passed a value that is well-formed but unusable. */
export class ToolInputError extends Error {}

type ToolContext = { signal?: AbortSignal; fetch?: typeof fetch; now?: () => Date };

type ToolDefinition<S extends z.ZodType> = {
  name: ToolName;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<string>;
};

function defineTool<S extends z.ZodType>(def: ToolDefinition<S>) {
  return def;
}

const describe = (name: ToolName) => TOOL_CATALOG.find((t) => t.name === name)!.description;

const calculator = defineTool({
  name: "calculator",
  description: `${describe("calculator")} Supports + - * / % ^, parentheses, sqrt, abs, round, floor, ceil, ln, log10, pi and e.`,
  schema: z.object({
    expression: z.string().min(1).max(500).describe("The arithmetic expression to evaluate."),
  }),
  async run({ expression }) {
    return formatNumber(evaluate(expression));
  },
});

const currentTime = defineTool({
  name: "current_time",
  description: describe("current_time"),
  schema: z.object({
    timeZone: z.string().max(64).default("UTC").describe('IANA time zone, for example "Europe/Stockholm".'),
  }),
  async run({ timeZone }, ctx) {
    const now = ctx.now?.() ?? new Date();
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
    } catch {
      throw new ToolInputError(`Unknown time zone "${timeZone}".`);
    }
    return `${formatted} (ISO ${now.toISOString()})`;
  },
});

const wikipediaSummary = defineTool({
  name: "wikipedia_summary",
  description: describe("wikipedia_summary"),
  schema: z.object({
    title: z.string().min(1).max(200).describe('Article title, for example "Alan Turing".'),
  }),
  async run({ title }, ctx) {
    const doFetch = ctx.fetch ?? fetch;
    // Fixed host: the model chooses only the title, so this tool can't be pointed at internal URLs.
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
    const res = await doFetch(url, {
      headers: { "user-agent": "Agentdeck/0.1 (portfolio project)", accept: "application/json" },
      signal,
    });
    if (res.status === 404) return `No Wikipedia article titled "${title}".`;
    if (!res.ok) throw new Error(`Wikipedia returned HTTP ${res.status}.`);
    const data = (await res.json()) as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
    const extract = (data.extract ?? "").slice(0, 1500);
    const link = data.content_urls?.desktop?.page ?? "";
    return [`# ${data.title ?? title}`, extract || "(no summary available)", link].filter(Boolean).join("\n\n");
  },
});

const REGISTRY = {
  calculator,
  current_time: currentTime,
  wikipedia_summary: wikipediaSummary,
} satisfies Record<ToolName, unknown>;

export function toolSpecs(names: readonly ToolName[]): ToolSpec[] {
  return names.map((name) => {
    const tool = REGISTRY[name];
    const schema = z.toJSONSchema(tool.schema, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    return { name: tool.name, description: tool.description, input_schema: schema };
  });
}

export type ToolOutcome = { output: string; isError: boolean };

/**
 * Executes a tool call from the model. Never throws: failures are returned as error results
 * so the model can see what went wrong and try again.
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  allowed: readonly ToolName[],
  ctx: ToolContext = {},
): Promise<ToolOutcome> {
  if (!(allowed as readonly string[]).includes(name)) {
    return { output: `Tool "${name}" is not enabled for this agent.`, isError: true };
  }
  const tool = REGISTRY[name as ToolName];
  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { output: `Invalid input. ${message}`, isError: true };
  }
  try {
    // The registry is keyed by name, so the parsed input matches this tool's schema.
    const output = await (tool.run as (input: unknown, ctx: ToolContext) => Promise<string>)(parsed.data, ctx);
    return { output, isError: false };
  } catch (err) {
    if (err instanceof CalculatorError || err instanceof ToolInputError) {
      return { output: err.message, isError: true };
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      return { output: "The tool timed out.", isError: true };
    }
    return { output: `The tool failed: ${err instanceof Error ? err.message : "unknown error"}`, isError: true };
  }
}
