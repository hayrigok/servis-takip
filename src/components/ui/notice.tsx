import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

type Tone = 'error' | 'success' | 'warning' | 'info';

const TONES: Record<Tone, string> = {
  error: 'border-danger bg-danger-soft text-danger',
  success: 'border-success bg-success-soft text-success',
  warning: 'border-warning bg-warning-soft text-warning',
  info: 'border-border-strong bg-surface-muted text-fg',
};

const ICONS = {
  error: CircleAlert,
  success: CircleCheck,
  warning: TriangleAlert,
  info: Info,
} as const;

/** Bilgi yalnızca renkle verilmez: simge + metin. Hata ekran okuyucuda hemen okunur (role="alert"). */
export function Notice({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title?: string;
  children?: React.ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-control border-l-4 p-3 ${TONES[tone]}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-base">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
