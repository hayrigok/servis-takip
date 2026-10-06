// text-lg (18 px): sahada okunaklı; 16 px'in üstünde olduğu için iPhone'da odaklanınca sayfa yakınlaşmaz.
const fieldBase =
  'block w-full min-h-14 rounded-control border-2 bg-surface px-3.5 py-2 text-lg text-fg placeholder:text-fg-muted disabled:cursor-not-allowed disabled:bg-surface-muted';

export function fieldClass(invalid: boolean): string {
  return `${fieldBase} ${invalid ? 'border-danger' : 'border-border-strong focus:border-fg'}`;
}

/** Alan etiketi: küçük, kalın, büyük harf (Saha). Büyük harfe CSS çevirir (lang="tr"), ekran okuyucu özgün metni okur. */
export const labelClass = 'text-sm font-bold tracking-wider text-fg uppercase';

export function describedBy(...ids: Array<string | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined || undefined;
}
