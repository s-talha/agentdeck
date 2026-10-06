import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/auth";
import { ButtonLink, StatusBadge } from "@/components/ui";
import { TOOL_CATALOG } from "@/lib/agent/catalog";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Agents" };

const toolLabel = (name: string) => TOOL_CATALOG.find((t) => t.name === name)?.label ?? name;

export default async function AgentsPage() {
  const userId = await requireUserId();
  const agents = await db.agent.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { runs: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
    },
  });

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 text-ink-soft">Each agent has its own instructions and the tools it may use.</p>
        </div>
        {agents.length > 0 && <ButtonLink href="/agents/new">New agent</ButtonLink>}
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule px-6 py-14 text-center">
          <h2 className="font-medium">No agents yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-ink-soft">
            Start with one that has a calculator. Ask it to price a job and watch it call the tool.
          </p>
          <ButtonLink href="/agents/new" className="mt-6">
            Create your first agent
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {agents.map((agent) => {
            const last = agent.runs[0];
            return (
              <li key={agent.id}>
                <Link
                  href={`/agents/${agent.id}`}
                  className="grid gap-2 px-1 py-5 transition-colors hover:bg-panel/70 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:px-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{agent.name}</p>
                    {agent.description && <p className="mt-0.5 truncate text-ink-soft">{agent.description}</p>}
                    <p className="mt-1.5 text-sm text-ink-faint">
                      {agent.tools.length > 0 ? agent.tools.map(toolLabel).join(", ") : "No tools"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-faint sm:justify-end">
                    {last ? (
                      <>
                        <StatusBadge status={last.status} />
                        <span>{timeAgo(last.createdAt)}</span>
                      </>
                    ) : (
                      <span>Not run yet</span>
                    )}
                    <span className="tabular-nums">
                      {agent._count.runs} {agent._count.runs === 1 ? "run" : "runs"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
