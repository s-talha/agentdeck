import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { updateAgent } from "../../actions";
import { AgentForm } from "../../agent-form";

export const metadata: Metadata = { title: "Edit agent" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const agent = await db.agent.findFirst({ where: { id, userId } });
  if (!agent) notFound();

  return (
    <>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Edit {agent.name}</h1>
      <AgentForm
        action={updateAgent.bind(null, agent.id)}
        defaults={{
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
          maxSteps: agent.maxSteps,
        }}
        submitLabel="Save changes"
        cancelHref={`/agents/${agent.id}`}
      />
    </>
  );
}
