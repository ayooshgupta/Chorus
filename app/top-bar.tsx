import Link from 'next/link';
import type { Membership } from '@/lib/session';

export default function TopBar({
  avatarUrl,
  active,
  memberships
}: {
  avatarUrl: string;
  active: Membership;
  memberships: Membership[];
}) {
  const palette = memberships.slice(0, 3).map((m) => m.colour);
  while (palette.length < 3) palette.push('#c9c6bf');

  return (
    <header className="topbar">
      <span className="wordmark">
        <span className="marks" aria-hidden="true">
          <i style={{ background: palette[0], height: 9 }} />
          <i style={{ background: palette[1], height: 15 }} />
          <i style={{ background: palette[2], height: 11 }} />
        </span>
        Chorus
      </span>

      <Link href="/settings" className="avatar-btn" aria-label="Your profile and settings">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={active.display_name}
            referrerPolicy="no-referrer"
            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span className="dot" style={{ background: active.colour, width: 34, height: 34 }}>
            {active.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>
    </header>
  );
}
