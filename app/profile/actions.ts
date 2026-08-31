'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';

export async function switchHousehold(householdId: string) {
  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateProfile(input: { displayName: string; colour: string }) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('members')
    .update({ display_name: input.displayName, colour: input.colour })
    .eq('id', me.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
