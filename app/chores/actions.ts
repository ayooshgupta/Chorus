'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';
import { nextDate, type Recurrence } from '@/lib/recurrence';
import type { ChoreDraft } from './chore-form';

export async function saveChore(draft: ChoreDraft) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const supabase = await createClient();

  const row = {
    household_id: me.household_id,
    name: draft.name,
    room: draft.room ? draft.room : null,
    notes: draft.notes ? draft.notes : null,
    assignment: draft.assignment,
    dedicated_member_id: draft.assignment === 'dedicated' ? draft.dedicatedMemberId : null,
    weight: draft.weight,
    freq: draft.freq,
    interval_n: draft.interval,
    byweekday: draft.freq === 'weekly' ? draft.byweekday : [],
    monthly_pattern: draft.freq === 'monthly' ? draft.monthlyPattern : null,
    anchor_date: draft.anchor,
    next_in_rotation:
      draft.assignment === 'alternating' ? (draft.rotationMemberIds[0] ?? null) : null
  };

  let choreId = draft.id;

  if (choreId) {
    const { error } = await supabase.from('chores').update(row).eq('id', choreId);
    if (error) return { error: error.message };

    await supabase.from('rotation_members').delete().eq('chore_id', choreId);
    await supabase.from('occurrences').delete().eq('chore_id', choreId).eq('status', 'open');
  } else {
    const { data, error } = await supabase.from('chores').insert(row).select('id').single();
    if (error || !data) return { error: error?.message ?? 'Could not save the chore.' };
    choreId = data.id;
  }

  if (draft.assignment === 'alternating' && choreId) {
    const rows = draft.rotationMemberIds.map((member_id, position) => ({
      chore_id: choreId as string,
      member_id,
      position
    }));
    const { error } = await supabase.from('rotation_members').insert(rows);
    if (error) return { error: error.message };
  }

  if (choreId) {
    const { data: past } = await supabase
      .from('occurrences')
      .select('original_due_on')
      .eq('chore_id', choreId)
      .order('original_due_on', { ascending: false })
      .limit(1);

    const recurrence: Recurrence = {
      freq: draft.freq,
      interval: draft.interval,
      byweekday: draft.freq === 'weekly' ? draft.byweekday : [],
      monthlyPattern: draft.freq === 'monthly' ? draft.monthlyPattern : null,
      anchor: draft.anchor
    };

    const due = nextDate(recurrence, past?.[0]?.original_due_on ?? null);

    if (due) {
      const assigned =
        draft.assignment === 'dedicated'
          ? draft.dedicatedMemberId
          : draft.assignment === 'alternating'
            ? (draft.rotationMemberIds[0] ?? null)
            : null;

      await supabase.from('occurrences').insert({
        chore_id: choreId,
        due_on: due,
        original_due_on: due,
        assigned_member_id: assigned
      });
    }
  }

  await supabase.from('activity').insert({
    household_id: me.household_id,
    actor_member_id: me.id,
    action: draft.id ? 'chore_updated' : 'chore_created',
    detail: { name: draft.name }
  });

  revalidatePath('/household');
  revalidatePath('/home');
  return { ok: true };
}

export async function archiveChore(choreId: string) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('chores')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', choreId);

  if (error) return { error: error.message };

  await supabase.from('occurrences').delete().eq('chore_id', choreId).eq('status', 'open');

  await supabase.from('activity').insert({
    household_id: me.household_id,
    actor_member_id: me.id,
    action: 'chore_archived'
  });

  revalidatePath('/household');
  revalidatePath('/home');
  return { ok: true };
}
