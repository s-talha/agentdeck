import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Trace, type TraceItem } from "@/components/trace";
import { ButtonLink } from "@/components/ui";

const sampleRun: TraceItem[] = [
  { kind: "text", text: "I'll check the hours against the rate, then add 25% VAT." },
  { kind: "tool_call", name: "calculator", input: { expression: "38.5 * 950 * 1.25" } },
  { kind: "tool_result", name: "calculator", output: "45718.75", isError: false },
  { kind: "text", text: "38.5 hours at 950 kr is 36,575 kr. With VAT the quote is 45,718.75 kr." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/agents");

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <span className="font-semibold tracking-tight">Agentdeck</span>
        <ButtonLink href="/login" variant="ghost">
          Sign in
        </ButtonLink>
      </header>

      <section className="grid flex-1 items-center gap-12 py-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div className="max-w-md">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Give an agent tools. Watch every step it takes.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Write instructions, choose the tools it may use, and run it. Each model turn and tool call streams in as it
            happens, and every run is saved so you can see exactly why it answered the way it did.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Create an account</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        </div>

        <figure className="rounded-lg border border-rule bg-panel/60 p-6 sm:p-8">
          <figcaption className="mb-6 border-b border-rule pb-4">
            <p className="text-sm text-ink-faint">Quote calculator</p>
            <p className="mt-1 font-medium">Price 38.5 hours at 950 kr an hour, including VAT.</p>
          </figcaption>
          <Trace items={sampleRun} />
          <p className="mt-6 flex justify-between border-t border-rule pt-4 text-sm text-ink-faint">
            <span>2 model turns, 1 tool call</span>
            <span>1.4 s</span>
          </p>
        </figure>
      </section>

      <footer className="py-8 text-sm text-ink-faint">
        Open source portfolio project. Runs on an offline demo model until you add an API key.
      </footer>
    </main>
  );
}
