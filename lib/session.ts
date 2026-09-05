import { cookies } from 'next/headers';
import { ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

export type Membership = {
  id: string;
  household_id: string;
  display_name: string;
  colour: string;
  householdName: string;
  reminderHour: number;
};

export type Session = {
  email: string;
  avatarUrl: string;
  active: Membership;
  memberships: Membership[];
};

export async function loadSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('members')
    .select('id, household_id, display_name, colour, archived_at, reminder_hour, households(name)')
    .eq('auth_user_id', user.id)
    .order('joined_at', { ascending: true });

  const memberships: Membership[] = (data ?? [])
    .filter((row) => !row.archived_at)
    .map((row) => {
    const house = row.households as unknown as { name: string } | null;
    return {
      id: row.id,
      household_id: row.household_id,
      display_name: row.display_name,
      colour: row.colour,
      householdName: house?.name ?? 'Household',
      reminderHour: row.reminder_hour
    };
  });

  if (memberships.length === 0) return null;

  const store = await cookies();
  const preferred = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const active = memberships.find((m) => m.household_id === preferred) ?? memberships[0];

  return { email: user.email ?? '', avatarUrl: (user.user_metadata?.avatar_url as string) ?? '', active, memberships };
}

export async function currentMember() {
  const session = await loadSession();
  return session?.active ?? null;
}
