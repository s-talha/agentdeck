import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUserId } from "@/auth";
import { ButtonLink, StatusBadge } from "@/components/ui";
import { TOOL_CATALOG } from "@/lib/agent/catalog";
import { db } from "@/lib/db";
import { formatDuration, timeAgo } from "@/lib/utils";
import { DeleteAgentButton } from "./delete-button";
import { RunConsole } from "./run-console";

type Props = { params: Promise<{ id: string }> };

// Deduped between generateMetadata and the page within one request.
const getAgent = cache(async (id: string) => {
  const userId = await requireUserId();
  return db.agent.findFirst({
    where: { id, userId },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await getAgent((await params).id);
  return { title: agent?.name ?? "Agent" };
}

const EXAMPLES: Record<string, string> = {
  calculator: "What is 38.5 * 950 * 1.25?",
  current_time: "What time is it in Europe/Stockholm?",
  wikipedia_summary: "Who is Grace Hopper?",
};

export default async function AgentPage({ params }: Props) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const tools = TOOL_CATALOG.filter((t) => agent.tools.includes(t.name));
  const examples = agent.tools.map((t) => EXAMPLES[t]).filter((e): e is string => Boolean(e));

  return (
    <>
      <Link href="/agents" className="text-sm text-ink-soft hover:text-ink">
        All agents
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          {agent.description && <p className="mt-1 text-ink-soft">{agent.description}</p>}
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/agents/${agent.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
          <DeleteAgentButton agentId={agent.id} name={agent.name} />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-10">
          <RunConsole agentId={agent.id} examples={examples.length ? examples : ["Introduce yourself in one sentence."]} />

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 font-medium">
              Run history
            </h2>
            {agent.runs.length === 0 ? (
              <p className="text-ink-soft">Runs appear here once you start one.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule" data-testid="run-history">
                {agent.runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/agents/${agent.id}/runs/${run.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 px-1 py-3 hover:bg-panel/70 sm:px-3"
                    >
                      <span className="truncate">{run.input}</span>
                      <span className="flex items-center gap-3 text-sm text-ink-faint">
                        <span className="hidden sm:inline">{formatDuration(run.durationMs)}</span>
                        <span className="hidden sm:inline">{timeAgo(run.createdAt)}</span>
                        <StatusBadge status={run.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 text-sm lg:border-l lg:border-rule lg:pl-8">
          <div>
            <h2 className="font-medium">Instructions</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap text-ink-soft">{agent.systemPrompt}</p>
          </div>
          <div>
            <h2 className="font-medium">Tools</h2>
            {tools.length === 0 ? (
              <p className="mt-2 text-ink-soft">None. The agent answers from the model alone.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {tools.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-ink-soft">
                    <span aria-hidden className="size-2 rounded-full bg-amber" />
                    {t.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="font-medium">Step limit</h2>
            <p className="mt-2 text-ink-soft">{agent.maxSteps} model turns per run</p>
          </div>
        </aside>
      </div>
    </>
  );
}
