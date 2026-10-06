import { Wrench } from 'lucide-react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-bg px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-center justify-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-control bg-signal text-signal-fg"
            aria-hidden="true"
          >
            <Wrench className="size-6" />
          </span>
          <span className="type-display text-2xl text-fg">Servis Takip</span>
        </p>
        <div className="rounded-card bg-surface p-6 shadow-card">{children}</div>
      </div>
    </main>
  );
}
