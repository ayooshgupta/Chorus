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

export async function archiveMember(memberId: string) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  if (memberId === me.id) return { error: 'You cannot archive yourself.' };

  const supabase = await createClient();

  // Verify the member is in the same household
  const { data: member } = await supabase
    .from('members')
    .select('id, household_id, display_name')
    .eq('id', memberId)
    .eq('household_id', me.household_id)
    .is('archived_at', null)
    .maybeSingle();

  if (!member) return { error: 'Member not found.' };

  // Archive the member
  await supabase
    .from('members')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', memberId);

  // Switch dedicated chores assigned to this member to adhoc
  await supabase
    .from('chores')
    .update({ assignment: 'adhoc', dedicated_member_id: null })
    .eq('household_id', me.household_id)
    .eq('assignment', 'dedicated')
    .eq('dedicated_member_id', memberId)
    .is('archived_at', null);

  // Remove from rotation_members
  const { data: rotationChores } = await supabase
    .from('rotation_members')
    .select('chore_id')
    .eq('member_id', memberId);

  if (rotationChores && rotationChores.length > 0) {
    await supabase
      .from('rotation_members')
      .delete()
      .eq('member_id', memberId);

    // For any alternating chore where next_in_rotation was this member,
    // advance to the next person
    for (const rc of rotationChores) {
      const { data: chore } = await supabase
        .from('chores')
        .select('id, next_in_rotation')
        .eq('id', rc.chore_id)
        .eq('next_in_rotation', memberId)
        .maybeSingle();

      if (chore) {
        const { data: remaining } = await supabase
          .from('rotation_members')
          .select('member_id, position')
          .eq('chore_id', chore.id)
          .order('position', { ascending: true })
          .limit(1);

        await supabase
          .from('chores')
          .update({
            next_in_rotation: remaining?.[0]?.member_id ?? null,
            // If no one left in rotation, switch to adhoc
            ...((!remaining || remaining.length === 0) ? { assignment: 'adhoc' } : {})
          })
          .eq('id', chore.id);
      }
    }
  }

  // Clear any open occurrences assigned to this member
  await supabase
    .from('occurrences')
    .update({ assigned_member_id: null, override_member_id: null })
    .eq('assigned_member_id', memberId)
    .eq('status', 'open');

  await supabase
    .from('occurrences')
    .update({ override_member_id: null })
    .eq('override_member_id', memberId)
    .eq('status', 'open');

  revalidatePath('/household');
  revalidatePath('/household/settings');
  revalidatePath('/home');
  return { ok: true };
}
