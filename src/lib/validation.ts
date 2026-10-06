import { z } from "zod";
import { TOOL_NAMES } from "@/lib/agent/catalog";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Use at most 128 characters."),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export const agentSchema = z.object({
  name: z.string().trim().min(1, "Give the agent a name.").max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(200, "Keep the description under 200 characters.").default(""),
  systemPrompt: z
    .string()
    .trim()
    .min(10, "Describe how the agent should behave in at least 10 characters.")
    .max(4000, "Keep instructions under 4,000 characters."),
  tools: z.array(z.enum(TOOL_NAMES)).max(TOOL_NAMES.length).default([]),
  maxSteps: z.coerce.number().int().min(1).max(12).default(6),
});

export type AgentInput = z.infer<typeof agentSchema>;

export const runRequestSchema = z.object({
  input: z.string().trim().min(1, "Write a task for the agent.").max(2000, "Keep the task under 2,000 characters."),
});

/** Turn zod issues into a { field: firstMessage } map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
