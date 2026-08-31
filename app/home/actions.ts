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
