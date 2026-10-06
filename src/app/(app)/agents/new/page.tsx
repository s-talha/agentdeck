import type { Metadata } from "next";
import { createAgent } from "../actions";
import { AgentForm } from "../agent-form";

export const metadata: Metadata = { title: "New agent" };

export default function NewAgentPage() {
  return (
    <>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">New agent</h1>
      <AgentForm action={createAgent} submitLabel="Create agent" cancelHref="/agents" />
    </>
  );
}
