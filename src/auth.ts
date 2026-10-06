import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signInSchema } from "@/lib/validation";

let dummyHashPromise: Promise<string> | undefined;
function dummyHash() {
  dummyHashPromise ??= bcrypt.hash("timing-equalizer-not-a-real-password", 12);
  return dummyHashPromise;
}

export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = signInSchema.safeParse(raw);
      if (!parsed.success) return null;

      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      // Compare against a dummy hash when the user is missing so timing doesn't reveal which emails exist.
      const hash = user?.passwordHash ?? (await dummyHash());
      const ok = await bcrypt.compare(parsed.data.password, hash);
      if (!user || !user.passwordHash || !ok) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

if (githubEnabled) providers.push(GitHub);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Credentials sign-in requires JWT sessions in Auth.js.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/** Returns the signed-in user's id, or null. Use in server code before touching user data. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns the signed-in user's id or redirects to sign in. Pages call this themselves
 * because layouts and pages render in parallel, so a layout check alone doesn't guard data access.
 */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  return userId;
}
