import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import { timeAgo } from '@/lib/recurrence';
import TopBar from '../top-bar';
import PageHeader from '../page-header';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

type Detail = { name?: string; until?: string; for?: string; shared?: boolean } | null;

function sentence(action: string, actor: string, detail: Detail, memberNames?: string[]): string {
  const name = detail?.name ?? 'a chore';

  switch (action) {
    case 'completed':
      if (detail?.shared && memberNames && memberNames.length > 1) {
        return `${memberNames.join(' and ')} did ${name}`;
      }
      return detail?.for ? `${actor} logged ${name} for ${detail.for}` : `${actor} did ${name}`;
    case 'skipped':
      return `${actor} skipped ${name}`;
    case 'deferred':
      return `${actor} pushed ${name} back`;
    case 'handed_off':
      return `${actor} handed ${name} over`;
    case 'chore_created':
      return `${actor} added ${name}`;
    case 'chore_updated':
      return `${actor} changed ${name}`;
    case 'chore_archived':
      return `${actor} archived a chore`;
    case 'member_joined':
      return `${actor} joined the household`;
    default:
      return `${actor} did something`;
  }
}

export default async function ActivityPage() {
  const session = await loadSession();
  if (!session) redirect('/setup');

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('activity')
    .select('id, action, detail, created_at, occurrence_id, members(display_name, colour), occurrences(chore_id, credited_members)')
    .eq('household_id', session.active.household_id)
    .order('created_at', { ascending: false })
    .limit(60);

  const items = rows ?? [];

  const { data: allMembers } = await supabase
    .from('members')
    .select('id, display_name, colour')
    .eq('household_id', session.active.household_id);

  const memberMap = new Map((allMembers ?? []).map((m) => [m.id, m]));

  return (
    <>
      <TopBar email={session.email} avatarUrl={session.avatarUrl} active={session.active} memberships={session.memberships} />
      <main>
        <PageHeader
          householdName={session.active.householdName}
          stat={items.length > 0 ? `Last ${items.length} updates` : undefined}
        />

        <div className="card">
          {items.length === 0 ? (
            <div className="empty">Nothing has happened yet.</div>
          ) : (
            items.map((row) => {
              const actor = row.members as unknown as {
                display_name: string;
                colour: string;
              } | null;

              const occ = row.occurrences as unknown as { chore_id: string; credited_members: string[] | null } | null;
              const choreId = occ?.chore_id ?? null;
              const credited = occ?.credited_members;
              const isShared = credited && credited.length > 1;
              const sharedNames = isShared
                ? credited.map((id: string) => memberMap.get(id)?.display_name ?? '').filter(Boolean)
                : [];
              const sharedColours = isShared
                ? credited.map((id: string) => memberMap.get(id)?.colour ?? '#9b978f')
                : [];

              const avatar = isShared ? (
                <svg width="26" height="26" viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
                  <circle cx="13" cy="13" r="13" fill={sharedColours[0]} />
                  <path d="M13 0 A13 13 0 0 1 13 26" fill={sharedColours[1]} />
                  {sharedColours[2] ? (
                    <path d="M13 0 L13 13 L24.26 5.88 A13 13 0 0 0 13 0 Z" fill={sharedColours[2]} />
                  ) : null}
                </svg>
              ) : (
                <div
                  className="dot"
                  style={{ background: actor?.colour ?? '#9b978f', width: 26, height: 26 }}
                >
                  {(actor?.display_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
              );

              const content = (
                <>
                  {avatar}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>
                      {sentence(row.action, actor?.display_name ?? 'Someone', row.detail as Detail, sharedNames)}
                    </div>
                    <div className="meta">{timeAgo(row.created_at)}</div>
                  </div>
                  {choreId ? (
                    <span style={{ color: 'var(--text-faint)', fontSize: 14, flexShrink: 0 }}>›</span>
                  ) : null}
                </>
              );

              return choreId ? (
                <Link
                  key={row.id}
                  href={`/chores/${choreId}`}
                  className="feed-row feed-link"
                >
                  {content}
                </Link>
              ) : (
                <div key={row.id} className="feed-row">
                  {content}
                </div>
              );
            })
          )}
        </div>
      </main>
      <Nav />
    </>
  );
}
