import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPush } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-off way to test the chore-completed push without touching any real
// chore/occurrence data. Pass ?member=<id> to target just one person, or
// ?household=<id> (optionally with ?exclude=<id,id>) to send to everyone
// currently subscribed in that household. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberId = req.nextUrl.searchParams.get('member');
  const householdId = req.nextUrl.searchParams.get('household');
  if (!memberId && !householdId) {
    return NextResponse.json({ error: 'Add ?member=<id> or ?household=<id>' }, { status: 400 });
  }

  const choreName = req.nextUrl.searchParams.get('chore') || 'Test chore';
  const who = req.nextUrl.searchParams.get('who') || 'Someone';
  const excluded = new Set(
    (req.nextUrl.searchParams.get('exclude') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const admin = createAdminClient();

  const query = admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, member_id, members!inner(household_id, archived_at)')
    .is('members.archived_at', null);

  const { data: subs, error } = memberId
    ? await query.eq('member_id', memberId)
    : await query.eq('members.household_id', householdId as string);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (subs ?? []).filter((s) => !excluded.has(s.member_id));
  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, note: 'No matching subscriptions — nobody to send to.' });
  }

  const result = await sendPush(
    targets.map((s) => ({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
    { title: `${choreName} done`, body: `${who} took care of it.`, url: '/home', tag: `chorus-activity-test` }
  );

  if (result.stale.length) {
    await admin.from('push_subscriptions').delete().in('id', result.stale);
  }

  return NextResponse.json({ sent: result.sent, pruned: result.stale.length, targeted: targets.length });
}
