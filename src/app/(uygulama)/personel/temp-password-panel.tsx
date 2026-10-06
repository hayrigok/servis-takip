'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

interface TempPasswordPanelProps {
  title: string;
  fullName: string;
  username: string;
  tempPassword: string;
  children?: React.ReactNode;
}

const termClass = 'text-sm font-bold tracking-wider text-fg-muted uppercase';

/** Geçici şifre yalnızca burada, bir kez gösterilir; sayfa yenilenince kaybolur. */
export function TempPasswordPanel({
  title,
  fullName,
  username,
  tempPassword,
  children,
}: TempPasswordPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copied = copyState === 'copied';

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopyState('copied');
    } catch {
      // Pano izni yoksa (eski tarayıcı, güvenli olmayan bağlantı) kullanıcı elle seçer.
      setCopyState('failed');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="success" title={title}>
        {fullName}
      </Notice>
      <dl className="grid gap-3">
        <div>
          <dt className={termClass}>Kullanıcı adı</dt>
          <dd className="font-mono text-lg text-fg">{username}</dd>
        </div>
        <div>
          <dt className={termClass}>Geçici şifre</dt>
          <dd
            className="font-mono text-2xl tracking-wider break-all text-fg select-all"
            data-testid="gecici-sifre"
          >
            {tempPassword}
          </dd>
        </div>
      </dl>
      <Button variant="secondary" onClick={copy}>
        {copied ? (
          <Check className="size-5" aria-hidden="true" />
        ) : (
          <Copy className="size-5" aria-hidden="true" />
        )}
        {copied ? 'Kopyalandı' : 'Şifreyi kopyala'}
      </Button>
      <p role="status" className={copyState === 'failed' ? 'text-sm text-fg-muted' : 'sr-only'}>
        {copyState === 'copied' && 'Şifre panoya kopyalandı.'}
        {copyState === 'failed' && 'Kopyalanamadı. Şifreyi basılı tutup seçerek kopyalayın.'}
      </p>
      <Notice tone="warning">
        Bu şifreyi kişiye iletin. Bir daha gösterilmeyecek. Kişi ilk girişte kendi şifresini
        belirleyecek.
      </Notice>
      {children}
    </div>
  );
}
