"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";
import { TOOL_CATALOG } from "@/lib/agent/catalog";
import type { AgentFormState } from "./actions";

type Defaults = {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
};

const EMPTY: Defaults = {
  name: "",
  description: "",
  systemPrompt: "",
  tools: ["calculator"],
  maxSteps: 6,
};

export function AgentForm({
  action,
  defaults = EMPTY,
  submitLabel,
  cancelHref,
}: {
  action: (state: AgentFormState, formData: FormData) => Promise<AgentFormState>;
  defaults?: Defaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const f = state.fields ?? {};
  const invalid = (name: string) => ({
    "aria-invalid": Boolean(f[name]),
    "aria-describedby": f[name] ? `${name}-error` : undefined,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-6" noValidate>
      <FormError message={state.error} />

      <Field label="Name" htmlFor="name" error={f.name}>
        <Input id="name" name="name" defaultValue={defaults.name} maxLength={60} required {...invalid("name")} />
      </Field>

      <Field label="Description" htmlFor="description" error={f.description} hint="Shown in your agent list.">
        <Input id="description" name="description" defaultValue={defaults.description} maxLength={200} {...invalid("description")} />
      </Field>

      <Field
        label="Instructions"
        htmlFor="systemPrompt"
        error={f.systemPrompt}
        hint="Sent as the system prompt on every run. Say what the agent is for and when it should use its tools."
      >
        <Textarea
          id="systemPrompt"
          name="systemPrompt"
          rows={7}
          defaultValue={defaults.systemPrompt}
          placeholder="You help a freelancer price work. Always use the calculator for arithmetic and show the formula."
          required
          {...invalid("systemPrompt")}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tools</legend>
        <p className="text-sm text-ink-faint">The agent can only call the tools you tick.</p>
        <div className="divide-y divide-rule rounded-md border border-rule bg-panel">
          {TOOL_CATALOG.map((tool) => (
            <label key={tool.name} className="flex cursor-pointer gap-3 px-3 py-3 has-[:checked]:bg-amber-wash/50">
              <input
                type="checkbox"
                name="tools"
                value={tool.name}
                defaultChecked={defaults.tools.includes(tool.name)}
                className="mt-1 size-4 accent-[var(--amber)]"
              />
              <span>
                <span className="block text-sm font-medium">{tool.label}</span>
                <span className="block text-sm text-ink-soft">{tool.description}</span>
              </span>
            </label>
          ))}
        </div>
        {f.tools && <p className="text-sm text-brick">{f.tools}</p>}
      </fieldset>

      <Field
        label="Step limit"
        htmlFor="maxSteps"
        error={f.maxSteps}
        hint="Model turns allowed per run, from 1 to 12. Stops runaway loops."
      >
        <Input
          id="maxSteps"
          name="maxSteps"
          type="number"
          min={1}
          max={12}
          defaultValue={defaults.maxSteps}
          className="w-24"
          {...invalid("maxSteps")}
        />
      </Field>

      <div className="flex gap-3 border-t border-rule pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </Button>
        <Link href={cancelHref} className="inline-flex h-9 items-center px-3 text-sm text-ink-soft hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}
