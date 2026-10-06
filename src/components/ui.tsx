import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-rule bg-panel text-ink hover:border-ink-faint",
  ghost: "text-ink-soft hover:text-ink hover:bg-ink/5",
  danger: "border border-rule bg-panel text-brick hover:border-brick",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 h-9 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...props} />;
}

const fieldBase =
  "w-full rounded-md border border-rule bg-panel px-3 text-sm text-ink placeholder:text-ink-faint focus:border-cobalt focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-cobalt/25 aria-[invalid=true]:border-brick";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "py-2 leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-brick">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-brick/30 bg-brick-wash px-3 py-2 text-sm text-brick">
      {message}
    </p>
  );
}

const statusStyles = {
  RUNNING: "bg-cobalt-wash text-cobalt",
  SUCCEEDED: "bg-teal-wash text-teal",
  FAILED: "bg-brick-wash text-brick",
  CANCELLED: "bg-ink/5 text-ink-soft",
} as const;

const statusLabels = {
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
} as const;

export function StatusBadge({ status }: { status: keyof typeof statusStyles }) {
  return (
    <span className={cn("inline-flex rounded px-1.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}
