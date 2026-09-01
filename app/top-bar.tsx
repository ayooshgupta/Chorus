'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBER_COLOURS } from '@/lib/config';
import { createClient } from '@/lib/supabase/browser';
import { switchHousehold, updateProfile } from './profile/actions';

export type HeaderMembership = {
  household_id: string;
  householdName: string;
  display_name: string;
  colour: string;
};

export default function TopBar({
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(active.display_name);
  const [colour, setColour] = useState(active.colour);
  const [busy, setBusy] = useState(false);

  function getTheme(): 'light' | 'dark' | 'system' {
    if (typeof document === 'undefined') return 'system';
    const stored = document.cookie.match(/(?:^|; )chorus-theme=(\w+)/)?.[1];
    return (stored as 'light' | 'dark' | 'system') ?? 'system';
  }
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(getTheme);

  function applyTheme(choice: 'light' | 'dark' | 'system') {
    setThemeState(choice);
    document.cookie = `chorus-theme=${choice};path=/;max-age=31536000;SameSite=Lax`;
    const resolved = choice === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : choice;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1a1918' : '#faf9f7');
  }

  const palette = memberships.slice(0, 3).map((m) => m.colour);
  while (palette.length < 3) palette.push('#c9c6bf');

  async function save() {
    setBusy(true);
    await updateProfile({ displayName: name.trim() || active.display_name, colour });
    setBusy(false);
    setEditing(false);
    setOpen(false);
    router.refresh();
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

  async function out() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

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

        <button className="avatar-btn" aria-label="Your profile" onClick={() => setOpen(true)}>
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
        <div
          className="scrim"
          onClick={() => {
            setOpen(false);
            setEditing(false);
          }}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={active.display_name}
                  referrerPolicy="no-referrer"
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span
                  className="dot"
                  style={{ background: colour, width: 44, height: 44, fontSize: 16 }}
                >
                  {(name || active.display_name).slice(0, 1).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{active.display_name}</div>
                <div className="meta">{email}</div>
              </div>
            </div>

            {editing ? (
              <>
                <div className="field">
                  <label htmlFor="p-name">Display name</label>
                  <input
                    id="p-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="field">
                  <span className="label">Your colour</span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {MEMBER_COLOURS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.name}
                        onClick={() => setColour(c.hex)}
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
                  <p className="hint">This is how you show up on the board and in trends.</p>
                </div>

                <button onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <div style={{ height: 8 }} />
                <button className="ghost" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {memberships.length > 1 ? (
                  <>
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
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: m.colour,
                            flex: 'none'
                          }}
                        />
                        {m.householdName}
                      </button>
                    ))}
                    <div style={{ height: 12 }} />
                  </>
                ) : null}

                <button className="ghost" onClick={() => setEditing(true)}>
                  Profile settings
                </button>
                <div style={{ height: 12 }} />
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
                <div style={{ height: 12 }} />
                <button className="ghost" onClick={() => router.push('/setup?new=1')}>
                  Create another household
                </button>
                <div style={{ height: 8 }} />
                <button className="ghost" onClick={out}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
