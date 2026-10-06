"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";

export type AuthFormState = {
  error?: string;
  fields?: Record<string, string>;
  values?: { name?: string; email?: string };
};

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) {
    return { fields: { email: "An account with this email already exists. Sign in instead." }, values };
  }

  try {
    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
      },
    });
  } catch (err) {
    // Two sign-ups with the same email at once: the unique index catches the second.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fields: { email: "An account with this email already exists. Sign in instead." }, values };
    }
    throw err;
  }

  return signInWithPassword(parsed.data.email, parsed.data.password, values);
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const values = { email: raw.email };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  return signInWithPassword(parsed.data.email, parsed.data.password, values);
}

async function signInWithPassword(email: string, password: string, values: AuthFormState["values"]) {
  try {
    // On success this throws Next's redirect, which must propagate.
    await signIn("credentials", { email, password, redirectTo: "/agents" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "That email and password don't match an account.", values };
    }
    throw err;
  }
}

export async function signInWithGitHubAction() {
  await signIn("github", { redirectTo: "/agents" });
}
