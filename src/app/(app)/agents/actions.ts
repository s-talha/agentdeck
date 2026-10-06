"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { agentSchema, fieldErrors } from "@/lib/validation";

export type AgentFormState = {
  error?: string;
  fields?: Record<string, string>;
};

function readAgentForm(formData: FormData) {
  return agentSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    systemPrompt: formData.get("systemPrompt") ?? "",
    tools: formData.getAll("tools"),
    maxSteps: formData.get("maxSteps") ?? undefined,
  });
}

export async function createAgent(_prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  const userId = await requireUserId();
  const parsed = readAgentForm(formData);
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const agent = await db.agent.create({ data: { ...parsed.data, userId } });
  revalidatePath("/agents");
  redirect(`/agents/${agent.id}`);
}

export async function updateAgent(
  agentId: string,
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const userId = await requireUserId();
  const parsed = readAgentForm(formData);
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  // updateMany with the owner in the filter makes the ownership check and the write one query.
  const { count } = await db.agent.updateMany({ where: { id: agentId, userId }, data: parsed.data });
  if (count === 0) return { error: "This agent no longer exists." };

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  redirect(`/agents/${agentId}`);
}

export async function deleteAgent(agentId: string): Promise<void> {
  const userId = await requireUserId();
  await db.agent.deleteMany({ where: { id: agentId, userId } });
  revalidatePath("/agents");
  redirect("/agents");
}
