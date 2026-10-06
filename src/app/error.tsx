'use client';

import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="type-display text-2xl text-fg">Bir şeyler ters gitti</h1>
      <p className="mt-2 text-base text-fg-muted">Sayfa yüklenemedi. Tekrar dener misiniz?</p>
      {error.digest && <p className="mt-2 text-sm text-fg-muted">Hata kodu: {error.digest}</p>}
      <Button className="mt-6" onClick={() => reset()}>
        Tekrar dene
      </Button>
    </main>
  );
}
