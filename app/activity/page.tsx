import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import { timeAgo } from '@/lib/recurrence';
import TopBar from '../top-bar';
import PageHeader from '../page-header';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

type Detail = { name?: string; until?: string; for?: string } | null;

function sentence(action: string, actor: string, detail: Detail): string {
  const name = detail?.name ?? 'a chore';

  switch (action) {
    case 'completed':
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
    .select('id, action, detail, created_at, occurrence_id, members(display_name, colour), occurrences(chore_id)')
    .eq('household_id', session.active.household_id)
    .order('created_at', { ascending: false })
    .limit(60);

  const items = rows ?? [];

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

              const occ = row.occurrences as unknown as { chore_id: string } | null;
              const choreId = occ?.chore_id ?? null;

              const content = (
                <>
                  <div
                    className="dot"
                    style={{ background: actor?.colour ?? '#9b978f', width: 26, height: 26 }}
                  >
                    {(actor?.display_name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>
                      {sentence(row.action, actor?.display_name ?? 'Someone', row.detail as Detail)}
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
