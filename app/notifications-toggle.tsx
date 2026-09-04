'use client';

import { useEffect, useRef, useState } from 'react';
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestNotification
} from './notifications/actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type State = 'loading' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

export default function NotificationsToggle() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mounted = useRef(true);

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
    "A morning nudge (around 7am) with the household's chores due today and anything overdue.";

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
        ? 'Add Chorus to your Home Screen, then open it from that icon to turn on reminders.'
        : state === 'blocked'
          ? 'Notifications are blocked. Turn them on for Chorus in your device settings, then reopen the app.'
          : "This browser can't do reminders. Try Chrome, or add Chorus to your Home Screen on iPhone.";
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
        <button type="button" className="link-btn" style={{ marginTop: 12 }} disabled={busy} onClick={test}>
          Send test notification
        </button>
      ) : null}
      {msg ? <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</div> : null}
    </>
  );
}
