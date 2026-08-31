import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import { bucketFor, friendlyDate, nextWeekendIso, todayIso, type Bucket } from '@/lib/recurrence';
import Board, { type Task } from './board';
import TopBar from '../top-bar';
import PageHeader from '../page-header';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await loadSession();
  if (!session) redirect('/setup');
  const me = session.active;

  const supabase = await createClient();
  const today = todayIso();

  const [{ data: members }, { data: rows }] = await Promise.all([
    supabase
      .from('members')
      .select('id, display_name, colour')
      .eq('household_id', me.household_id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('occurrences')
      .select(
        'id, due_on, original_due_on, assigned_member_id, override_member_id, chores!inner(id, name, assignment, weight, room, household_id)'
      )
      .eq('status', 'open')
      .eq('chores.household_id', me.household_id)
      .order('due_on', { ascending: true })
  ]);

  const memberList = (members ?? []).map((m) => ({
    id: m.id,
    name: m.display_name,
    colour: m.colour
  }));
  const byId = new Map(memberList.map((m) => [m.id, m]));

  const tasks: (Task & { bucket: Bucket })[] = [];

  for (const row of rows ?? []) {
    const bucket = bucketFor(row.due_on, today);
    if (!bucket) continue;

    const chore = row.chores as unknown as {
      id: string;
      name: string;
      assignment: string;
      weight: number;
      room: string | null;
    };

    const ownerId = row.override_member_id ?? row.assigned_member_id;
    const owner = ownerId ? byId.get(ownerId) : null;

    tasks.push({
      id: row.id,
      choreId: chore.id,
      name: chore.name,
      assignment: chore.assignment,
      weight: chore.weight,
      room: chore.room ?? null,
      dueOn: row.due_on,
      deferred: row.due_on !== row.original_due_on,
      when: friendlyDate(row.due_on, today),
      ownerId: ownerId ?? null,
      ownerName: owner?.name ?? null,
      ownerColour: owner?.colour ?? null,
      bucket
    });
  }

  const sections: { key: Bucket; label: string; late?: boolean }[] = [
    { key: 'overdue', label: 'Overdue', late: true },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'weekend', label: 'This weekend' }
  ];

  return (
    <>
      <TopBar email={session.email} avatarUrl={session.avatarUrl} active={me} memberships={session.memberships} />
      <main>
        <PageHeader
          householdName={me.householdName}
          stat={
            tasks.length === 0
              ? 'Nothing due. Enjoy it.'
              : `${tasks.length} ${tasks.length === 1 ? 'thing' : 'things'} to get to`
          }
        />

        <Board
          tasks={tasks}
          sections={sections}
          members={memberList}
          meId={me.id}
          weekendIso={nextWeekendIso(today)}
        />
      </main>
      <Nav />
    </>
  );
}
