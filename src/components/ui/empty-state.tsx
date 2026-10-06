import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-card border-2 border-dashed border-border-strong px-4 py-10 text-center">
      <Inbox className="size-10 text-fg-muted" aria-hidden="true" />
      <h2 className="mt-3 type-display text-xl text-fg">{title}</h2>
      <p className="mt-1 max-w-sm text-base text-fg-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
