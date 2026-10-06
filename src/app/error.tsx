"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-semibold tracking-tight">This page failed to load</h1>
      <p className="mt-2 text-ink-soft">
        The server hit an error. Try again, and if it keeps happening check the server logs
        {error.digest ? ` for error ${error.digest}` : ""}.
      </p>
      <Button onClick={reset} className="mt-6 w-fit">
        Try again
      </Button>
    </main>
  );
}
