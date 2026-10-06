type BadgeTone = 'neutral' | 'primary' | 'danger' | 'success' | 'warning';

// Saha: 4 px köşe, büyük harf, kalın. "primary" sarı işaret rengidir (ör. "Sahaya çıkar").
const TONES: Record<BadgeTone, string> = {
  neutral: 'border-fg text-fg',
  primary: 'border-signal bg-signal text-signal-fg',
  danger: 'border-danger-soft bg-danger-soft text-danger',
  success: 'border-success-soft bg-success-soft text-success',
  warning: 'border-warning-soft bg-warning-soft text-warning',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border-2 px-2 py-0.5 text-sm font-extrabold tracking-wider uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
