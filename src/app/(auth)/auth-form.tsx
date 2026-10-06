"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { signInAction, signUpAction, type AuthFormState } from "./actions";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});
  const f = state.fields ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.error} />

      {mode === "signup" && (
        <Field label="Name" htmlFor="name" error={f.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name}
            aria-invalid={Boolean(f.name)}
            aria-describedby={f.name ? "name-error" : undefined}
            required
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email" error={f.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(f.email)}
          aria-describedby={f.email ? "email-error" : undefined}
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={f.password}
        hint={mode === "signup" ? "At least 10 characters." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          aria-invalid={Boolean(f.password)}
          aria-describedby={f.password ? "password-error" : undefined}
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {mode === "signup" ? (pending ? "Creating account" : "Create account") : pending ? "Signing in" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-ink-soft">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-cobalt underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-cobalt underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
