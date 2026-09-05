'use client';

import { useEffect, useRef, useState } from 'react';
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestNotification,
  updateReminderHour
} from './notifications/actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

type Period = 'am' | 'pm';

function to12Hour(hour24: number): { hour12: number; period: Period } {
  const period: Period = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24Hour(hour12: number, period: Period): number {
  const base = hour12 % 12;
  return period === 'pm' ? base + 12 : base;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type State = 'loading' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

export default function NotificationsToggle({ initialReminderHour }: { initialReminderHour: number }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reminderHour, setReminderHour] = useState(initialReminderHour);
  const [hourOpen, setHourOpen] = useState(false);
  const [savingHour, setSavingHour] = useState(false);
  const mounted = useRef(true);

  const { hour12, period } = to12Hour(reminderHour);

  async function commitHour(hour24: number) {
    if (hour24 === reminderHour) return;
    const previous = reminderHour;
    setReminderHour(hour24);
    setSavingHour(true);
    const result = await updateReminderHour(hour24);
    setSavingHour(false);
    if (result?.error) {
      setReminderHour(previous);
      setMsg(result.error);
    }
  }

  function choosePeriod(next: Period) {
    commitHour(to24Hour(hour12, next));
  }

  function chooseHour12(next: number) {
    setHourOpen(false);
    commitHour(to24Hour(next, period));
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === 'undefined') return;

      const ua = navigator.userAgent;
      const isIOS = /iP(hone|ad|od)/.test(ua);
      const standalone =
        ('standalone' in navigator && (navigator as unknown as { standalone?: boolean }).standalone) ||
        window.matchMedia('(display-mode: standalone)').matches;

      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (isIOS && !standalone) {
        setState('needs-install');
        return;
      }
      if (!supported) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('blocked');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (mounted.current) setState(sub ? 'on' : 'off');
      } catch {
        if (mounted.current) setState('off');
      }
    }
    init();
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) {
      setMsg('Reminders are not configured yet.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const result = await savePushSubscription(
        { endpoint: json.endpoint ?? '', keys: json.keys ?? { p256dh: '', auth: '' } },
        navigator.userAgent
      );

      if (result?.error) {
        await sub.unsubscribe().catch(() => {});
        setMsg(result.error);
        setState('off');
      } else {
        setState('on');
      }
    } catch {
      setMsg('Could not turn on reminders. Try again.');
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState('off');
    } catch {
      setMsg('Could not turn off reminders.');
    }
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const result = await sendTestNotification();
    setMsg(result?.error ? result.error : 'Sent — check your notifications.');
    setBusy(false);
  }

  const body =
    "A morning nudge with what's due today and anything overdue, plus a ping whenever someone completes a chore.";

  if (state === 'loading') {
    return (
      <div className="notif-row">
        <div>
          <div className="notif-title">Daily reminder</div>
          <div className="notif-sub">{body}</div>
        </div>
        <span className="notif-switch" aria-hidden="true" />
      </div>
    );
  }

  if (state === 'needs-install' || state === 'unsupported' || state === 'blocked') {
    const hint =
      state === 'needs-install'
        ? 'Add Chorus to your Home Screen, then open it from that icon to turn on notifications.'
        : state === 'blocked'
          ? 'Notifications are blocked. Turn them on for Chorus in your device settings, then reopen the app.'
          : "This browser can't do notifications. Try Chrome, or add Chorus to your Home Screen on iPhone.";
    return (
      <div className="notif-row" data-disabled="true">
        <div>
          <div className="notif-title">Daily reminder</div>
          <div className="notif-sub">{hint}</div>
        </div>
        <span className="notif-switch" aria-hidden="true" />
      </div>
    );
  }

  const on = state === 'on';

  return (
    <>
      <div className="notif-row">
        <div>
          <div className="notif-title">Daily reminder</div>
          <div className="notif-sub">{body}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Daily reminder"
          className="notif-switch"
          data-on={on}
          disabled={busy}
          onClick={on ? disable : enable}
        />
      </div>

      {on ? (
        <div style={{ marginTop: 14 }}>
          <div className="notif-row">
            <div>
              <div className="notif-title">Reminder time</div>
              <div className="notif-sub">What time your daily nudge shows up.</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                className="house-row"
                style={{ width: 52, marginBottom: 0, justifyContent: 'center', fontSize: 13 }}
                disabled={savingHour}
                onClick={() => setHourOpen((o) => !o)}
              >
                {hour12}
              </button>
              <div className="seg" style={{ width: 84 }}>
                <button type="button" data-on={period === 'am'} disabled={savingHour} onClick={() => choosePeriod('am')}>
                  AM
                </button>
                <button type="button" data-on={period === 'pm'} disabled={savingHour} onClick={() => choosePeriod('pm')}>
                  PM
                </button>
              </div>
            </div>
          </div>

          {hourOpen ? (
            <div className="member-popover-grid" style={{ marginTop: 10, gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {HOURS_12.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="house-row"
                  style={{ justifyContent: 'center', fontSize: 13 }}
                  data-on={h === hour12}
                  onClick={() => chooseHour12(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {on ? (
        <button type="button" className="link-btn" style={{ marginTop: 12 }} disabled={busy} onClick={test}>
          Send test notification
        </button>
      ) : null}
      {msg ? <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</div> : null}
    </>
  );
}
