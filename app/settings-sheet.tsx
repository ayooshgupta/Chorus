'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBER_COLOURS } from '@/lib/config';
import { createClient } from '@/lib/supabase/browser';
import { switchHousehold, updateProfile } from './profile/actions';
import NotificationsToggle from './notifications-toggle';

export type HeaderMembership = {
  household_id: string;
  householdName: string;
  display_name: string;
  colour: string;
};

type ThemeChoice = 'light' | 'dark' | 'system';

export default function SettingsSheet({
  email,
  avatarUrl,
  active,
  memberships
}: {
  email: string;
  avatarUrl: string;
  active: HeaderMembership;
  memberships: HeaderMembership[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(active.display_name);
  const [colour, setColour] = useState(active.colour);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | 'profile'>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(active.display_name);
    setColour(active.colour);
  }, [active.display_name, active.colour]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  function flashSaved() {
    setSaved('profile');
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(null), 1800);
  }

  async function persist(next: { displayName: string; colour: string }) {
    setBusy(true);
    const result = await updateProfile(next);
    setBusy(false);
    if (!result?.error) {
      flashSaved();
      router.refresh();
    }
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(active.display_name);
      return;
    }
    if (trimmed === active.display_name) return;
    persist({ displayName: trimmed, colour });
  }

  function pickColour(hex: string) {
    if (hex === colour) return;
    setColour(hex);
    persist({ displayName: name.trim() || active.display_name, colour: hex });
  }

  // ---- theme ----
  function getTheme(): ThemeChoice {
    if (typeof document === 'undefined') return 'system';
    const stored = document.cookie.match(/(?:^|; )chorus-theme=(\w+)/)?.[1];
    return (stored as ThemeChoice) ?? 'system';
  }
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme);

  function applyTheme(choice: ThemeChoice) {
    setThemeState(choice);
    document.cookie = `chorus-theme=${choice};path=/;max-age=31536000;SameSite=Lax`;
    const resolved =
      choice === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : choice;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1a1918' : '#faf9f7');
  }

  async function choose(householdId: string) {
    if (householdId === active.household_id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    await switchHousehold(householdId);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const palette = memberships.slice(0, 3).map((m) => m.colour);
  while (palette.length < 3) palette.push('#c9c6bf');

  return (
    <>
      <header className="topbar">
        <span className="wordmark">
          <span className="marks" aria-hidden="true">
            <i style={{ background: palette[0], height: 9 }} />
            <i style={{ background: palette[1], height: 15 }} />
            <i style={{ background: palette[2], height: 11 }} />
          </span>
          Chorus
        </span>

        <button className="avatar-btn" aria-label="Your profile and settings" onClick={() => setOpen(true)}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={active.display_name}
              referrerPolicy="no-referrer"
              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span className="dot" style={{ background: active.colour, width: 34, height: 34 }}>
              {active.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      {open ? (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={active.display_name}
                  referrerPolicy="no-referrer"
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span className="dot" style={{ background: colour, width: 44, height: 44, fontSize: 16 }}>
                  {(name || active.display_name).slice(0, 1).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{active.display_name}</div>
                <div className="meta">{email}</div>
              </div>
            </div>

            <div className="set-group">
              <span className="label">Display name</span>
              <input
                type="text"
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </div>

            <div className="set-group">
              <span className="label">
                Your colour
                {saved === 'profile' ? <span className="saved-tag">Saved</span> : null}
              </span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {MEMBER_COLOURS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    aria-label={c.name}
                    disabled={busy}
                    onClick={() => pickColour(c.hex)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      padding: 0,
                      background: c.hex,
                      border: colour === c.hex ? '2px solid var(--text)' : '2px solid transparent'
                    }}
                  />
                ))}
              </div>
              <p className="hint">How you show up on the board and in trends.</p>
            </div>

            <div className="set-group">
              <span className="label">Appearance</span>
              <div className="theme-toggle">
                {(['light', 'dark', 'system'] as const).map((opt) => (
                  <button
                    key={opt}
                    className="theme-opt"
                    data-on={theme === opt}
                    onClick={() => applyTheme(opt)}
                  >
                    {opt === 'light' ? 'Light' : opt === 'dark' ? 'Dark' : 'System'}
                  </button>
                ))}
              </div>
            </div>

            <div className="set-group">
              <span className="label">Notifications</span>
              <NotificationsToggle initialReminderHour={active.reminderHour} />
            </div>

            <div className="set-group">
              <span className="label">Household</span>
              {memberships.map((m) => (
                <button
                  key={m.household_id}
                  className="house-row"
                  data-on={m.household_id === active.household_id}
                  disabled={busy}
                  onClick={() => choose(m.household_id)}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: m.colour, flex: 'none' }}
                  />
                  {m.householdName}
                </button>
              ))}
              <button
                className="house-row"
                style={{ borderStyle: 'dashed', color: 'var(--text-soft)' }}
                onClick={() => router.push('/setup?new=1')}
              >
                <span style={{ width: 10, textAlign: 'center', flex: 'none' }}>+</span>
                Create another household
              </button>
            </div>

            <button className="ghost" style={{ marginTop: 8 }} onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
