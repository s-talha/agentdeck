import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="mt-2 text-ink-soft">This page doesn’t exist, or it belongs to another account.</p>
      <ButtonLink href="/agents" className="mt-6 w-fit">
        Go to your agents
      </ButtonLink>
    </main>
  );
}
