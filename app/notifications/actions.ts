'use server';

import { createClient } from '@/lib/supabase/server';
import { currentMember } from '@/lib/session';
import { sendPush } from '@/lib/push';

type SubInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscription(sub: SubInput, userAgent: string) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { error: 'That subscription looks incomplete.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: me.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: (userAgent || '').slice(0, 300),
      fail_count: 0
    },
    { onConflict: 'endpoint' }
  );

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string) {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('member_id', me.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function sendTestNotification() {
  const me = await currentMember();
  if (!me) return { error: 'You are not signed in.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('member_id', me.id);

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'No device is registered yet.' };

  let result;
  try {
    result = await sendPush(data, {
      title: '',
      body: 'Test — notifications are working on this device. ✅',
      url: '/home',
      tag: 'chorus-test'
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send the test.' };
  }

  if (result.stale.length) {
    await supabase.from('push_subscriptions').delete().in('id', result.stale);
  }

  if (result.sent === 0) return { error: 'The push service rejected the test. Try turning reminders off and on.' };
  return { ok: true, sent: result.sent };
}
