import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush, type PushRow } from '@/lib/push';
import { todayIso } from '@/lib/recurrence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Title is intentionally empty — iOS shows the app name ("Chorus") on its own
// and appending a custom title makes the unlocked banner read "… from Chorus".
// Everything goes in the body.
function buildMessage(dueToday: number, overdue: number) {
  if (dueToday && overdue) {
    return { title: '', body: 'Chores due today, and a few are overdue. Tap to open the board.' };
  }
  if (dueToday) {
    return { title: '', body: 'Chores due today. Tap to open the board.' };
  }
  return { title: '', body: 'A few chores are overdue. Tap to catch up.' };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayIso();

  const [{ data: occ, error: occErr }, { data: subs, error: subErr }] = await Promise.all([
    supabase.from('occurrences').select('due_on, chores!inner(household_id)').eq('status', 'open'),
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, members!inner(household_id, archived_at)')
  ]);

  if (occErr || subErr) {
    return NextResponse.json({ error: occErr?.message ?? subErr?.message }, { status: 500 });
  }

  const counts = new Map<string, { overdue: number; dueToday: number }>();
  for (const row of occ ?? []) {
    const householdId = (row.chores as unknown as { household_id: string }).household_id;
    const c = counts.get(householdId) ?? { overdue: 0, dueToday: 0 };
    if (row.due_on < today) c.overdue += 1;
    else if (row.due_on === today) c.dueToday += 1;
    counts.set(householdId, c);
  }

  const byHousehold = new Map<string, PushRow[]>();
  for (const s of subs ?? []) {
    const member = s.members as unknown as { household_id: string; archived_at: string | null };
    if (member.archived_at) continue;
    const list = byHousehold.get(member.household_id) ?? [];
    list.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    byHousehold.set(member.household_id, list);
  }

  let sent = 0;
  let pruned = 0;
  const households: Record<string, unknown> = {};

  for (const [householdId, rows] of byHousehold) {
    const c = counts.get(householdId) ?? { overdue: 0, dueToday: 0 };
    if (c.overdue === 0 && c.dueToday === 0) {
      households[householdId] = { skipped: 'nothing due' };
      continue;
    }

    const { title, body } = buildMessage(c.dueToday, c.overdue);
    const result = await sendPush(rows, { title, body, url: '/home', tag: 'chorus-daily' });

    sent += result.sent;
    if (result.stale.length) {
      await supabase.from('push_subscriptions').delete().in('id', result.stale);
      pruned += result.stale.length;
    }
    households[householdId] = {
      dueToday: c.dueToday,
      overdue: c.overdue,
      sent: result.sent,
      pruned: result.stale.length
    };
  }

  return NextResponse.json({ ran: today, sent, pruned, households });
}
