"use client";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="absolute inset-0 bp-hero-glow pointer-events-none" />
      <div className="relative bp-surface rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-6">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function Field({
  label,
  value,
  onChange,
  type,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[var(--bp-text-dim)]">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md bg-black border border-[var(--bp-border-strong)] px-3 py-2 outline-none focus:border-[var(--bp-accent)] transition-colors"
      />
    </label>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 my-5 text-xs text-[var(--bp-text-dim)]">
      <div className="h-px flex-1 bg-[var(--bp-border)]" />
      or
      <div className="h-px flex-1 bg-[var(--bp-border)]" />
    </div>
  );
}
