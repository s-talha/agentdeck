import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, githubEnabled } from "@/auth";
import { Button } from "@/components/ui";
import { signInWithGitHubAction } from "./actions";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) redirect("/agents");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-10 font-semibold tracking-tight">
        Agentdeck
      </Link>
      {children}
      {githubEnabled && (
        <form action={signInWithGitHubAction} className="mt-6 border-t border-rule pt-6">
          <Button type="submit" variant="secondary" className="w-full">
            Continue with GitHub
          </Button>
        </form>
      )}
    </main>
  );
}
