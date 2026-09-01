import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';
import ChoreForm, { type HistoryEntry } from '../chore-form';

export const dynamic = 'force-dynamic';

export default async function EditChore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const me = await currentMember();
  if (!me) redirect('/setup');

  const supabase = await createClient();

  const [{ data: chore }, { data: members }, { data: rotation }, { data: roomRows }, { data: past }] =
    await Promise.all([
      supabase
        .from('chores')
        .select(
          'id, name, room, notes, assignment, dedicated_member_id, weight, freq, interval_n, byweekday, monthly_pattern, anchor_date'
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('members')
        .select('id, display_name, colour')
        .eq('household_id', me.household_id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('rotation_members')
        .select('member_id, position')
        .eq('chore_id', id)
        .order('position', { ascending: true }),
      supabase
        .from('chores')
        .select('room')
        .eq('household_id', me.household_id)
        .is('archived_at', null)
        .not('room', 'is', null),
      supabase
        .from('occurrences')
        .select('id, original_due_on, status, completed_by')
        .eq('chore_id', id)
        .neq('status', 'open')
        .order('original_due_on', { ascending: false })
        .limit(10)
    ]);

  if (!chore) notFound();

  const knownRooms = Array.from(
    new Set((roomRows ?? []).map((r) => (r.room ?? '').trim()).filter(Boolean))
  ).sort();

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  const history: HistoryEntry[] = (past ?? []).map((row) => {
    const who = row.completed_by ? memberMap.get(row.completed_by) : null;
    return {
      occurrenceId: row.id,
      date: row.original_due_on,
      status: row.status,
      who: who?.display_name ?? null,
      whoId: row.completed_by ?? null,
      colour: row.status === 'done' && who ? who.colour : null
    };
  });

  return (
    <ChoreForm
      members={members ?? []}
      knownRooms={knownRooms}
      history={history}
      initial={{
        id: chore.id,
        name: chore.name,
        room: chore.room ?? '',
        notes: chore.notes ?? '',
        freq: chore.freq,
        interval: chore.interval_n,
        byweekday: chore.byweekday ?? [],
        monthlyPattern: chore.monthly_pattern ?? 'day_of_month',
        anchor: chore.anchor_date,
        weight: chore.weight,
        assignment: chore.assignment,
        dedicatedMemberId: chore.dedicated_member_id,
        rotationMemberIds: (rotation ?? []).map((r) => r.member_id)
      }}
    />
  );
}
