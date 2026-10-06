export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card bg-surface p-4 shadow-card sm:p-6 ${className ?? ''}`}>
      {children}
    </section>
  );
}
