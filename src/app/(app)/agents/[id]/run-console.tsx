"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Trace, type TraceItem } from "@/components/trace";
import { Button, FormError, Textarea } from "@/components/ui";
import type { RunEvent } from "@/lib/agent/types";
import { createSSEParser } from "@/lib/sse";
import { formatDuration } from "@/lib/utils";

type Phase = "idle" | "running" | "finished";

type Summary = { runId?: string; model?: string; tokens?: number; durationMs?: number; ok?: boolean };

export function RunConsole({ agentId, examples }: { agentId: string; examples: string[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<TraceItem[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [requestError, setRequestError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || phase === "running") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("running");
    setItems([]);
    setSummary({});
    setRequestError(undefined);

    try {
      const res = await fetch(`/api/agents/${agentId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRequestError(body.error ?? `The run could not start (HTTP ${res.status}).`);
        setPhase("idle");
        return;
      }

      const parser = createSSEParser<RunEvent>();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const event of parser.push(value)) apply(event);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setItems((prev) => [...prev, { kind: "error", message: err instanceof Error ? err.message : "Connection lost." }]);
      } else {
        setItems((prev) => [...prev, { kind: "error", message: "Run cancelled." }]);
      }
    } finally {
      abortRef.current = null;
      setPhase("finished");
      // Pull the new run into the history list.
      router.refresh();
    }
  }

  function apply(event: RunEvent) {
    switch (event.type) {
      case "run":
        setSummary((s) => ({ ...s, runId: event.runId, model: event.model }));
        break;
      case "text":
        setItems((prev) => [...prev, { kind: "text", text: event.text }]);
        break;
      case "tool_call":
        setItems((prev) => [...prev, { kind: "tool_call", name: event.name, input: event.input }]);
        break;
      case "tool_result":
        setItems((prev) => [
          ...prev,
          { kind: "tool_result", name: event.name, output: event.output, isError: event.isError },
        ]);
        break;
      case "done":
        setSummary((s) => ({
          ...s,
          ok: true,
          durationMs: event.durationMs,
          tokens: event.usage.inputTokens + event.usage.outputTokens,
        }));
        break;
      case "error":
        setItems((prev) => [...prev, { kind: "error", message: event.message }]);
        setSummary((s) => ({ ...s, ok: false }));
        break;
      case "step":
        break;
    }
  }

  return (
    <section aria-label="Run this agent" className="rounded-lg border border-rule bg-panel/60">
      <form onSubmit={start} className="border-b border-rule p-4 sm:p-5">
        <label htmlFor="task" className="block text-sm font-medium">
          Give it a task
        </label>
        <Textarea
          id="task"
          rows={3}
          className="mt-2"
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder={examples[0]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {phase === "running" ? (
            <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
              Stop run
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              Run agent
            </Button>
          )}
          {phase === "idle" &&
            examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="rounded-md px-2 py-1 text-left text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                {example}
              </button>
            ))}
        </div>
        <div className="mt-3">
          <FormError message={requestError} />
        </div>
      </form>

      {phase !== "idle" && (
        <div className="p-4 sm:p-6" data-testid="run-trace">
          <Trace items={items} animate pending={phase === "running"} />
          {phase === "finished" && summary.runId && (
            <p className="mt-6 flex flex-wrap justify-between gap-2 border-t border-rule pt-4 text-sm text-ink-faint">
              <span>
                {summary.model}
                {summary.tokens ? `, ${summary.tokens.toLocaleString("en")} tokens` : ""}
                {summary.durationMs ? `, ${formatDuration(summary.durationMs)}` : ""}
              </span>
              <Link href={`/agents/${agentId}/runs/${summary.runId}`} className="text-cobalt underline-offset-4 hover:underline">
                Open saved run
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
