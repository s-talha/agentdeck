import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { RunStep } from "@prisma/client";
import { requireUserId } from "@/auth";
import { Trace, type TraceItem } from "@/components/trace";
import { StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Run" };

function toTraceItem(step: RunStep): TraceItem {
  const content = (step.content ?? {}) as Record<string, unknown>;
  switch (step.type) {
    case "TEXT":
      return { kind: "text", text: String(content.text ?? "") };
    case "TOOL_CALL":
      return { kind: "tool_call", name: step.toolName ?? "tool", input: content.input };
    case "TOOL_RESULT":
      return { kind: "tool_result", name: step.toolName ?? "tool", output: String(content.output ?? ""), isError: step.isError };
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function RunPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const userId = await requireUserId();
  const run = await db.run.findFirst({
    where: { id: runId, agentId: id, userId },
    include: { steps: { orderBy: { index: "asc" } }, agent: { select: { name: true } } },
  });
  if (!run) notFound();

  const items = run.steps.map(toTraceItem);
  if (run.error) items.push({ kind: "error", message: run.error });
  const toolCalls = run.steps.filter((s) => s.type === "TOOL_CALL").length;

  const facts = [
    { label: "Started", value: dateFormat.format(run.createdAt) },
    { label: "Duration", value: formatDuration(run.durationMs) || "Still running" },
    { label: "Model", value: run.model },
    { label: "Tool calls", value: String(toolCalls) },
    { label: "Tokens", value: (run.inputTokens + run.outputTokens).toLocaleString("en") },
  ];

  return (
    <>
      <Link href={`/agents/${id}`} className="text-sm text-ink-soft hover:text-ink">
        {run.agent.name}
      </Link>

      <div className="mt-3 mb-8 max-w-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Run</h1>
          <StatusBadge status={run.status} />
        </div>
        <p className="mt-3 text-lg leading-relaxed">{run.input}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0 rounded-lg border border-rule bg-panel/60 p-4 sm:p-6">
          {items.length > 0 ? <Trace items={items} /> : <p className="text-ink-soft">This run has no recorded steps.</p>}
        </div>
        <dl className="grid h-fit grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-1">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-ink-faint">{f.label}</dt>
              <dd className="mt-0.5 tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
