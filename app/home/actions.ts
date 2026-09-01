'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';
import { addDays, parseDate, toIso } from '@/lib/recurrence';

async function loadContext(occurrenceId: string) {
  const me = await currentMember();
  if (!me) return null;

  const supabase = await createClient();

  const { data: occurrence } = await supabase
    .from('occurrences')
    .select('id, chore_id, due_on, assigned_member_id, override_member_id, status')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (!occurrence) return null;

  const { data: chore } = await supabase
    .from('chores')
    .select('id, name, weight, assignment, next_in_rotation, household_id')
    .eq('id', occurrence.chore_id)
    .maybeSingle();

  if (!chore) return null;

  return { me, supabase, occurrence, chore };
}

async function advanceRotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  choreId: string,
  currentMemberId: string | null
) {
  const { data: rotation } = await supabase
    .from('rotation_members')
    .select('member_id, position')
    .eq('chore_id', choreId)
    .order('position', { ascending: true });

  if (!rotation || rotation.length === 0) return;

  const index = rotation.findIndex((r) => r.member_id === currentMemberId);
  const next = rotation[(index + 1) % rotation.length];

  await supabase.from('chores').update({ next_in_rotation: next.member_id }).eq('id', choreId);
}

async function reverseRotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  choreId: string,
  currentMemberId: string | null
) {
  const { data: rotation } = await supabase
    .from('rotation_members')
    .select('member_id, position')
    .eq('chore_id', choreId)
    .order('position', { ascending: true });

  if (!rotation || rotation.length === 0) return;

  const index = rotation.findIndex((r) => r.member_id === currentMemberId);
  const prev = rotation[(index - 1 + rotation.length) % rotation.length];

  await supabase.from('chores').update({ next_in_rotation: prev.member_id }).eq('id', choreId);
}

export async function completeTask(occurrenceId: string, creditToMemberId?: string) {
  const ctx = await loadContext(occurrenceId);
  if (!ctx) return { error: 'Could not find that chore.' };

  const { me, supabase, occurrence, chore } = ctx;
  const credited = creditToMemberId ?? me.id;

  const { error } = await supabase
    .from('occurrences')
    .update({
      status: 'done',
      completed_by: credited,
      completed_at: new Date().toISOString(),
      weight_at_completion: chore.weight
    })
    .eq('id', occurrenceId)
    .eq('status', 'open');

  if (error) return { error: error.message };

  if (chore.assignment === 'alternating') {
    await advanceRotation(supabase, chore.id, occurrence.assigned_member_id);
  }

  let onBehalfOf: string | null = null;
  if (credited !== me.id) {
    const { data: other } = await supabase
      .from('members')
      .select('display_name')
      .eq('id', credited)
      .maybeSingle();
    onBehalfOf = other?.display_name ?? null;
  }

  await supabase.from('activity').insert({
    household_id: chore.household_id,
    occurrence_id: occurrenceId,
    actor_member_id: me.id,
    action: 'completed',
    detail: onBehalfOf ? { name: chore.name, for: onBehalfOf } : { name: chore.name }
  });

  revalidatePath('/home');
  revalidatePath('/activity');
  revalidatePath('/household');
  return { ok: true };
}

export async function skipTask(occurrenceId: string) {
  const ctx = await loadContext(occurrenceId);
  if (!ctx) return { error: 'Could not find that chore.' };

  const { me, supabase, occurrence, chore } = ctx;

  const { error } = await supabase
    .from('occurrences')
    .update({ status: 'skipped' })
    .eq('id', occurrenceId)
    .eq('status', 'open');

  if (error) return { error: error.message };

  if (chore.assignment === 'alternating') {
    await advanceRotation(supabase, chore.id, occurrence.assigned_member_id);
  }

  await supabase.from('activity').insert({
    household_id: chore.household_id,
    occurrence_id: occurrenceId,
    actor_member_id: me.id,
    action: 'skipped',
    detail: { name: chore.name }
  });

  revalidatePath('/home');
  revalidatePath('/activity');
  revalidatePath('/household');
  return { ok: true };
}

export async function deferTask(occurrenceId: string, days: number, explicitIso?: string) {
  const ctx = await loadContext(occurrenceId);
  if (!ctx) return { error: 'Could not find that chore.' };

  const { me, supabase, occurrence, chore } = ctx;

  const target = explicitIso ?? toIso(addDays(parseDate(occurrence.due_on), days));

  const { error } = await supabase
    .from('occurrences')
    .update({ due_on: target })
    .eq('id', occurrenceId)
    .eq('status', 'open');

  if (error) return { error: error.message };

  await supabase.from('activity').insert({
    household_id: chore.household_id,
    occurrence_id: occurrenceId,
    actor_member_id: me.id,
    action: 'deferred',
    detail: { name: chore.name, until: target }
  });

  revalidatePath('/home');
  revalidatePath('/activity');
  return { ok: true };
}

export async function handOffTask(occurrenceId: string, memberId: string) {
  const ctx = await loadContext(occurrenceId);
  if (!ctx) return { error: 'Could not find that chore.' };

  const { me, supabase, chore } = ctx;

  const { error } = await supabase
    .from('occurrences')
    .update({ override_member_id: memberId })
    .eq('id', occurrenceId)
    .eq('status', 'open');

  if (error) return { error: error.message };

  await supabase.from('activity').insert({
    household_id: chore.household_id,
    occurrence_id: occurrenceId,
    actor_member_id: me.id,
    action: 'handed_off',
    detail: { name: chore.name }
  });

  revalidatePath('/home');
  revalidatePath('/activity');
  return { ok: true };
}

export async function undoComplete(occurrenceId: string) {
  const me = await currentMember();
  if (!me) return { error: 'Not signed in.' };

  const supabase = await createClient();

  const { data: occurrence } = await supabase
    .from('occurrences')
    .select('id, chore_id, assigned_member_id, status')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (!occurrence || occurrence.status !== 'done') return { error: 'Cannot undo.' };

  const { data: chore } = await supabase
    .from('chores')
    .select('id, assignment, next_in_rotation, household_id')
    .eq('id', occurrence.chore_id)
    .maybeSingle();

  if (!chore) return { error: 'Chore not found.' };

  // Delete the newer open occurrence sync may have created
  await supabase
    .from('occurrences')
    .delete()
    .eq('chore_id', chore.id)
    .eq('status', 'open');

  // Revert the occurrence back to open
  await supabase
    .from('occurrences')
    .update({
      status: 'open',
      completed_by: null,
      completed_at: null,
      weight_at_completion: null
    })
    .eq('id', occurrenceId);

  // Reverse rotation if alternating
  if (chore.assignment === 'alternating') {
    await reverseRotation(supabase, chore.id, chore.next_in_rotation);
  }

  // Delete the activity entry
  await supabase
    .from('activity')
    .delete()
    .eq('occurrence_id', occurrenceId)
    .eq('action', 'completed');

  revalidatePath('/home');
  revalidatePath('/activity');
  revalidatePath('/household');
  return { ok: true };
}

export async function undoSkip(occurrenceId: string) {
  const me = await currentMember();
  if (!me) return { error: 'Not signed in.' };

  const supabase = await createClient();

  const { data: occurrence } = await supabase
    .from('occurrences')
    .select('id, chore_id, assigned_member_id, status')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (!occurrence || occurrence.status !== 'skipped') return { error: 'Cannot undo.' };

  const { data: chore } = await supabase
    .from('chores')
    .select('id, assignment, next_in_rotation, household_id')
    .eq('id', occurrence.chore_id)
    .maybeSingle();

  if (!chore) return { error: 'Chore not found.' };

  // Delete the newer open occurrence sync may have created
  await supabase
    .from('occurrences')
    .delete()
    .eq('chore_id', chore.id)
    .eq('status', 'open');

  // Revert back to open
  await supabase
    .from('occurrences')
    .update({ status: 'open' })
    .eq('id', occurrenceId);

  // Reverse rotation if alternating
  if (chore.assignment === 'alternating') {
    await reverseRotation(supabase, chore.id, chore.next_in_rotation);
  }

  // Delete the activity entry
  await supabase
    .from('activity')
    .delete()
    .eq('occurrence_id', occurrenceId)
    .eq('action', 'skipped');

  revalidatePath('/home');
  revalidatePath('/activity');
  revalidatePath('/household');
  return { ok: true };
}
