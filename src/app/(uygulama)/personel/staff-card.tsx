import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/server/roles';
import type { StaffListItem } from '@/server/staff/service';

export function StaffCard({ staff }: { staff: StaffListItem }) {
  return (
    <Link
      href={`/personel/${staff.id}`}
      className="@container flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card hover:bg-surface-muted"
    >
      <div className="min-w-0">
        <p className="type-display text-xl break-words text-fg">{staff.fullName}</p>
        <p className="text-base break-words text-fg-muted">{staff.username}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{ROLE_LABELS[staff.role]}</Badge>
          {staff.fieldWork && <Badge tone="primary">Sahaya çıkar</Badge>}
          {staff.isLocked && <Badge tone="danger">Kilitli</Badge>}
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {staff.lastLoginAt
            ? `Son giriş: ${formatDateTime(staff.lastLoginAt)}`
            : 'Henüz giriş yapmadı'}
        </p>
      </div>
      {/* Kart dar kalınca (büyük yazı) ok gizlenir, rozetlere yer açılır; eşik rem'le yazıyla birlikte büyür. */}
      <ChevronRight
        className="hidden size-6 shrink-0 text-fg-muted @3xs:block"
        aria-hidden="true"
      />
    </Link>
  );
}
