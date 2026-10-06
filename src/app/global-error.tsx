'use client';

import './globals.css';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body>
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <h1 className="type-display text-2xl text-fg">Bir şeyler ters gitti</h1>
          <p className="mt-2 text-base text-fg-muted">Uygulama açılamadı. Tekrar dener misiniz?</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 min-h-12 rounded-control bg-primary px-5 type-display text-lg text-primary-fg"
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
