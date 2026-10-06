// Client-safe metadata about the built-in tools. Implementations live in tools.ts.

export const TOOL_CATALOG = [
  {
    name: "calculator",
    label: "Calculator",
    description: "Evaluates arithmetic like (12 + 3) * 4 ^ 2 or sqrt(81).",
  },
  {
    name: "current_time",
    label: "Current time",
    description: "Returns the current date and time in any IANA time zone.",
  },
  {
    name: "wikipedia_summary",
    label: "Wikipedia lookup",
    description: "Fetches the lead summary of an English Wikipedia article.",
  },
] as const;

export type ToolName = (typeof TOOL_CATALOG)[number]["name"];

export const TOOL_NAMES = TOOL_CATALOG.map((t) => t.name) as [ToolName, ...ToolName[]];

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}
