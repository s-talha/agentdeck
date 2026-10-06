import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create an account</h1>
      <AuthForm mode="signup" />
    </>
  );
}
