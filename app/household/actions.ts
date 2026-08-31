'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';

export async function addMember(input: {
  householdId: string;
  displayName: string;
  email: string;
  colour: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from('members').insert({
    household_id: input.householdId,
    display_name: input.displayName,
    email: input.email,
    colour: input.colour
  });

  if (error) {
    if (error.code === '23505') return { error: 'Someone with that email is already here.' };
    return { error: error.message };
  }

  revalidatePath('/household');
  revalidatePath('/household/settings');
  return { ok: true };
}

export async function renameHousehold(name: string) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Give the household a name.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('households')
    .update({ name: trimmed })
    .eq('id', me.household_id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
