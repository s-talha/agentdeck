"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteAgent } from "../actions";

export function DeleteAgentButton({ agentId, name }: { agentId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete "${name}" and all of its runs? This can't be undone.`)) return;
        startTransition(() => deleteAgent(agentId));
      }}
    >
      {pending ? "Deleting" : "Delete"}
    </Button>
  );
}
