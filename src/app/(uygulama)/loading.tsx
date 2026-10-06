export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Yükleniyor…</span>
      <div className="h-8 w-48 animate-pulse rounded-control bg-surface-muted" />
      <div className="h-20 animate-pulse rounded-card bg-surface-muted" />
      <div className="h-20 animate-pulse rounded-card bg-surface-muted" />
    </div>
  );
}
