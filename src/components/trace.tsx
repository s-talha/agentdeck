import { TOOL_CATALOG } from "@/lib/agent/catalog";
import { cn } from "@/lib/utils";

export type TraceItem =
  | { kind: "text"; text: string }
  | { kind: "tool_call"; name: string; input: unknown }
  | { kind: "tool_result"; name: string; output: string; isError: boolean }
  | { kind: "error"; message: string };

const toolLabel = (name: string) => TOOL_CATALOG.find((t) => t.name === name)?.label ?? name;

function formatInput(input: unknown): string {
  if (input && typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>);
    // Single-argument calls read better inline: calculator("12 * 7")
    if (entries.length === 1) return JSON.stringify(entries[0]![1]);
  }
  return JSON.stringify(input, null, 2);
}

const nodeColor: Record<TraceItem["kind"], string> = {
  text: "bg-cobalt",
  tool_call: "bg-amber",
  tool_result: "bg-teal",
  error: "bg-brick",
};

/**
 * A run rendered as a wire with one node per event. Model turns, tool calls and
 * tool results each get their own colour so the shape of a run is visible at a glance.
 */
export function Trace({ items, animate = false, pending = false }: { items: TraceItem[]; animate?: boolean; pending?: boolean }) {
  return (
    <ol className="relative space-y-4 pl-6" aria-live={animate ? "polite" : undefined}>
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-rule" />
      {items.map((item, i) => (
        <li key={i} className={cn("relative", animate && "trace-node-enter")}>
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-6 size-[11px] rounded-full ring-4 ring-paper",
              item.kind === "tool_result" && item.isError ? "bg-brick" : nodeColor[item.kind],
            )}
          />
          <TraceBody item={item} />
        </li>
      ))}
      {pending && (
        <li className="relative">
          <span aria-hidden className="absolute top-1.5 -left-6 size-[11px] animate-pulse rounded-full bg-ink-faint ring-4 ring-paper motion-reduce:animate-none" />
          <p className="text-sm text-ink-faint">Waiting for the model</p>
        </li>
      )}
    </ol>
  );
}

function TraceBody({ item }: { item: TraceItem }) {
  switch (item.kind) {
    case "text":
      return <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{item.text}</p>;
    case "tool_call":
      return (
        <div>
          <p className="text-sm text-amber">
            Calls <span className="font-medium">{toolLabel(item.name)}</span>
          </p>
          <pre className="mt-1 overflow-x-auto font-mono text-[13px] whitespace-pre-wrap text-ink-soft">
            {formatInput(item.input)}
          </pre>
        </div>
      );
    case "tool_result":
      return (
        <div>
          <p className={cn("text-sm", item.isError ? "text-brick" : "text-teal")}>
            {item.isError ? `${toolLabel(item.name)} failed` : `${toolLabel(item.name)} returned`}
          </p>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-rule bg-panel px-3 py-2 font-mono text-[13px] whitespace-pre-wrap text-ink-soft">
            {item.output}
          </pre>
        </div>
      );
    case "error":
      return <p className="text-sm text-brick">{item.message}</p>;
  }
}
