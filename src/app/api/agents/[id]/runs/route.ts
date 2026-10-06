import { Prisma, RunStatus, StepType } from "@prisma/client";
import { currentUserId } from "@/auth";
import { isToolName } from "@/lib/agent/catalog";
import { getProvider } from "@/lib/agent/providers";
import { runAgent } from "@/lib/agent/runner";
import type { RunEvent } from "@/lib/agent/types";
import { db } from "@/lib/db";
import { encodeSSE } from "@/lib/sse";
import { runRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RUNS_PER_HOUR = Number(process.env.RUNS_PER_HOUR ?? 30);

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Starts a run and streams its events as Server-Sent Events. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return problem(401, "Sign in to run agents.");

  const { id } = await ctx.params;
  const parsed = runRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem(400, parsed.error.issues[0]?.message ?? "Invalid request.");

  // Scope by owner: another user's agent id behaves exactly like a missing one.
  const agent = await db.agent.findFirst({ where: { id, userId } });
  if (!agent) return problem(404, "Agent not found.");

  const recentRuns = await db.run.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentRuns >= RUNS_PER_HOUR) {
    return problem(429, `You've reached ${RUNS_PER_HOUR} runs this hour. Try again later.`);
  }

  const provider = getProvider();
  const run = await db.run.create({
    data: { agentId: agent.id, userId, input: parsed.data.input, model: provider.model },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          // The client disconnected. Keep going so the run is still recorded.
        }
      };

      send({ type: "run", runId: run.id, model: provider.model });

      let index = 0;
      let final: Extract<RunEvent, { type: "done" | "error" }> | undefined;
      const started = Date.now();

      try {
        for await (const event of runAgent({
          provider,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools.filter(isToolName),
          input: parsed.data.input,
          maxSteps: agent.maxSteps,
          signal: req.signal,
        })) {
          send(event);
          const step = toStep(event);
          if (step) await db.runStep.create({ data: { ...step, runId: run.id, index: index++ } });
          if (event.type === "done" || event.type === "error") final = event;
        }
      } catch (err) {
        final = { type: "error", message: err instanceof Error ? err.message : "The run failed." };
        send(final);
      }

      const status =
        final?.type === "done" ? RunStatus.SUCCEEDED : req.signal.aborted ? RunStatus.CANCELLED : RunStatus.FAILED;

      await db.run.update({
        where: { id: run.id },
        data: {
          status,
          output: final?.type === "done" ? final.output : null,
          error: final?.type === "error" ? final.message : null,
          inputTokens: final?.type === "done" ? final.usage.inputTokens : 0,
          outputTokens: final?.type === "done" ? final.usage.outputTokens : 0,
          durationMs: Date.now() - started,
          finishedAt: new Date(),
        },
      });

      try {
        controller.close();
      } catch {
        // Already closed by a disconnect.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

function toStep(event: RunEvent): Omit<Prisma.RunStepUncheckedCreateInput, "runId" | "index"> | null {
  switch (event.type) {
    case "text":
      return { type: StepType.TEXT, content: { text: event.text } };
    case "tool_call":
      return {
        type: StepType.TOOL_CALL,
        toolName: event.name,
        content: { id: event.id, input: (event.input ?? {}) as Prisma.InputJsonValue },
      };
    case "tool_result":
      return {
        type: StepType.TOOL_RESULT,
        toolName: event.name,
        isError: event.isError,
        content: { id: event.id, output: event.output },
      };
    default:
      return null;
  }
}
