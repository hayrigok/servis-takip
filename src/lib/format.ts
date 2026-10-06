const formatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "6 Ekim 2026 12:05". Parçalardan kurulur: tarayıcılar arasında ayraç farkı olmasın. */
export function formatDateTime(date: Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}`;
}
