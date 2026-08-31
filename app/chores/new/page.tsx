import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';
import { todayIso } from '@/lib/recurrence';
import ChoreForm from '../chore-form';

export const dynamic = 'force-dynamic';

export default async function NewChore() {
  const me = await currentMember();
  if (!me) redirect('/setup');

  const supabase = await createClient();

  const [{ data: members }, { data: roomRows }] = await Promise.all([
    supabase
      .from('members')
      .select('id, display_name, colour')
      .eq('household_id', me.household_id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('chores')
      .select('room')
      .eq('household_id', me.household_id)
      .is('archived_at', null)
      .not('room', 'is', null)
  ]);

  const knownRooms = Array.from(
    new Set((roomRows ?? []).map((r) => (r.room ?? '').trim()).filter(Boolean))
  ).sort();

  const today = todayIso();
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  return (
    <ChoreForm
      members={members ?? []}
      knownRooms={knownRooms}
      history={[]}
      initial={{
        name: '',
        room: '',
        notes: '',
        freq: 'weekly',
        interval: 1,
        byweekday: [weekday],
        monthlyPattern: 'day_of_month',
        anchor: today,
        weight: 2,
        assignment: 'alternating',
        dedicatedMemberId: me.id,
        rotationMemberIds: (members ?? []).map((x) => x.id)
      }}
    />
  );
}
