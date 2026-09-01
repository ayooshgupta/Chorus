import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import { AssignmentIcon, GearIcon } from '@/lib/icons';
import {
  addDays,
  describe,
  formatLoad,
  parseDate,
  perWeek,
  toIso,
  todayIso,
  type Recurrence
} from '@/lib/recurrence';
import RoomSection from './room-section';
import TopBar from '../top-bar';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

export default async function Household() {
  const session = await loadSession();
  if (!session) redirect('/setup');
  const me = session.active;

  const supabase = await createClient();
  const since = toIso(addDays(parseDate(todayIso()), -28));

  const [{ data: memberRows }, { data: choreRows }, { data: rotationRows }] = await Promise.all([
    supabase
      .from('members')
      .select('id, display_name, colour')
      .eq('household_id', me.household_id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('chores')
      .select(
        'id, name, notes, room, assignment, dedicated_member_id, weight, freq, interval_n, byweekday, monthly_pattern, anchor_date'
      )
      .eq('household_id', me.household_id)
      .is('archived_at', null)
      .order('name', { ascending: true }),
    supabase.from('rotation_members').select('chore_id, member_id')
  ]);

  const members = memberRows ?? [];
  const chores = choreRows ?? [];
  const rotations = rotationRows ?? [];
  const choreIds = chores.map((c) => c.id);

  const { data: closedRows } = choreIds.length
    ? await supabase
        .from('occurrences')
        .select('chore_id, original_due_on, status, completed_by, completed_at, weight_at_completion, credited_members')
        .in('chore_id', choreIds)
        .neq('status', 'open')
        .order('original_due_on', { ascending: true })
    : { data: [] };

  const closed = closedRows ?? [];

  const planned = new Map<string, number>();
  members.forEach((m) => planned.set(m.id, 0));

  for (const chore of chores) {
    const recurrence: Recurrence = {
      freq: chore.freq,
      interval: chore.interval_n,
      byweekday: chore.byweekday ?? [],
      monthlyPattern: chore.monthly_pattern,
      anchor: chore.anchor_date
    };
    const weekly = perWeek(recurrence) * chore.weight;

    if (chore.assignment === 'dedicated' && chore.dedicated_member_id) {
      planned.set(chore.dedicated_member_id, (planned.get(chore.dedicated_member_id) ?? 0) + weekly);
    } else if (chore.assignment === 'alternating') {
      const sharers = rotations.filter((r) => r.chore_id === chore.id);
      if (sharers.length) {
        const each = weekly / sharers.length;
        sharers.forEach((r) => planned.set(r.member_id, (planned.get(r.member_id) ?? 0) + each));
      }
    }
  }

  const plannedTotal = [...planned.values()].reduce((a, b) => a + b, 0);

  const actual = new Map<string, number>();
  members.forEach((m) => actual.set(m.id, 0));

  for (const row of closed) {
    if (row.status !== 'done' || !row.completed_by || !row.completed_at) continue;
    if (row.completed_at.slice(0, 10) < since) continue;
    const w = row.weight_at_completion ?? 0;
    if (row.credited_members && row.credited_members.length > 1) {
      const share = w / row.credited_members.length;
      for (const mid of row.credited_members) {
        actual.set(mid, (actual.get(mid) ?? 0) + share);
      }
    } else {
      actual.set(row.completed_by, (actual.get(row.completed_by) ?? 0) + w);
    }
  }

  const actualTotal = [...actual.values()].reduce((a, b) => a + b, 0);

  const colourOf = new Map(members.map((m) => [m.id, m.colour]));
  const trends = new Map<string, { colours: string[] }[]>();

  for (const row of closed) {
    const list = trends.get(row.chore_id) ?? [];
    if (row.status === 'done' && row.credited_members && row.credited_members.length > 1) {
      list.push({
        colours: row.credited_members
          .map((mid: string) => colourOf.get(mid))
          .filter(Boolean) as string[]
      });
    } else if (row.status === 'done' && row.completed_by) {
      list.push({ colours: [colourOf.get(row.completed_by) ?? ''] });
    } else {
      list.push({ colours: [] });
    }
    trends.set(row.chore_id, list);
  }

  const notch =
    members.length === 2 && plannedTotal > 0
      ? ((planned.get(members[0].id) ?? 0) / plannedTotal) * 100
      : null;

  const rooms: { label: string; items: typeof chores }[] = [];
  for (const chore of chores) {
    const label = chore.room?.trim() ? chore.room.trim() : 'No room';
    const found = rooms.find((r) => r.label.toLowerCase() === label.toLowerCase());
    if (found) found.items.push(chore);
    else rooms.push({ label, items: [chore] });
  }
  rooms.sort((a, b) => {
    if (a.label === 'No room') return 1;
    if (b.label === 'No room') return -1;
    return a.label.localeCompare(b.label);
  });

  return (
    <>
      <TopBar email={session.email} avatarUrl={session.avatarUrl} active={me} memberships={session.memberships} />
      <main>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <h1 style={{ margin: 0 }}>{me.householdName}</h1>
          <Link
            href="/household/settings"
            aria-label="Household settings"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-soft)',
              background: 'var(--surface-alt)',
              flex: 'none'
            }}
          >
            <GearIcon />
          </Link>
        </div>
        <p className="sub">
          {members.length} {members.length === 1 ? 'member' : 'members'} · {chores.length}{' '}
          {chores.length === 1 ? 'chore' : 'chores'}
        </p>

        {actualTotal > 0 || plannedTotal > 0 ? (
          <div className="card" style={{ marginBottom: 26 }}>
            <span className="label">Effort · last 4 weeks</span>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <div className="bar">
                {members.map((m) => {
                  const share = actualTotal > 0 ? ((actual.get(m.id) ?? 0) / actualTotal) * 100 : 0;
                  return share > 0 ? (
                    <div key={m.id} style={{ width: `${share}%`, background: m.colour }} />
                  ) : null;
                })}
              </div>
              {notch !== null ? <div className="notch" style={{ left: `${notch}%` }} /> : null}
            </div>

            {plannedTotal > 0 ? (
              <>
                <div style={{ height: 12 }} />
                <span className="label">
                  Planned · next week
                </span>
                <div className="bar">
                  {members.map((m) => {
                    const share = ((planned.get(m.id) ?? 0) / plannedTotal) * 100;
                    return share > 0 ? (
                      <div key={m.id} style={{ width: `${share}%`, background: m.colour }} />
                    ) : null;
                  })}
                </div>
              </>
            ) : null}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                marginTop: 12,
                fontSize: 12,
                color: 'var(--text-soft)'
              }}
            >
              {members.map((m) => (
                <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.colour }} />
                  {m.display_name}
                  {plannedTotal > 0 ? ` · ${formatLoad(planned.get(m.id) ?? 0)}/wk` : ''}
                </span>
              ))}
            </div>
            {notch !== null ? (
              <p className="hint">The marker on the effort bar is your planned split.</p>
            ) : null}
          </div>
        ) : null}

        {chores.length === 0 ? (
          <div className="card">
            <div className="empty">No chores yet. Add the first one.</div>
          </div>
        ) : (
          rooms.map((room) => (
            <RoomSection key={room.label} label={room.label} count={room.items.length}>
              {room.items.map((chore) => {
                const dots = (trends.get(chore.id) ?? []).slice(-10);

                return (
                  <Link key={chore.id} href={`/chores/${chore.id}`} className="chore-row">
                    <span className="name-line" style={{ fontSize: 15 }}>
                      <AssignmentIcon kind={chore.assignment} />
                      {chore.name}
                    </span>
                    <div className="meta" style={{ marginTop: 3 }}>
                      {describe({
                        freq: chore.freq,
                        interval: chore.interval_n,
                        byweekday: chore.byweekday ?? [],
                        monthlyPattern: chore.monthly_pattern,
                        anchor: chore.anchor_date
                      })}
                    </div>
                    {chore.notes ? <div className="chore-note">{chore.notes}</div> : null}
                    {dots.length ? (
                      <div className="trend">
                        {dots.map((d, i) =>
                          d.colours.length > 1 ? (
                            <svg key={i} width="8" height="8" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="4" fill={d.colours[0]} />
                              <path d="M4 0 A4 4 0 0 1 4 8" fill={d.colours[1]} />
                              {d.colours[2] ? (
                                <path d="M4 0 L4 4 L7.46 2.27 A4 4 0 0 0 4 0 Z" fill={d.colours[2]} />
                              ) : null}
                            </svg>
                          ) : d.colours.length === 1 ? (
                            <span key={i} style={{ background: d.colours[0] }} />
                          ) : (
                            <span
                              key={i}
                              style={{ background: 'transparent', border: '1px solid var(--line-strong)' }}
                            />
                          )
                        )}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </RoomSection>
          ))
        )}
      </main>
      <Link href="/chores/new" className="fab" aria-label="Add chore">
        +
      </Link>
      <Nav />
    </>
  );
}
