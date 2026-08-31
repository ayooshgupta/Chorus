'use client';

import { useState } from 'react';
import { MEMBER_COLOURS } from '@/lib/config';
import { createHousehold } from './actions';

export default function SetupForm({
  email,
  suggestedName,
  another
}: {
  email: string;
  suggestedName: string;
  another: boolean;
}) {
  const [household, setHousehold] = useState('');
  const [name, setName] = useState(suggestedName);
  const [colour, setColour] = useState(MEMBER_COLOURS[0].hex);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!household.trim()) {
      setError('Give your household a name.');
      return;
    }
    if (!name.trim()) {
      setError('Add your own name.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await createHousehold({
      householdName: household.trim(),
      displayName: name.trim(),
      colour
    });

    if (result?.error) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <main style={{ paddingTop: 40 }}>
      {another ? (
        <a href="/home" className="back">
          ← Back
        </a>
      ) : null}
      <h1>{another ? 'New household' : 'Set up your household'}</h1>
      <p className="sub">
        {another
          ? 'You can switch between households from your profile.'
          : `Signed in as ${email}. You can add other people next.`}
      </p>

      <div className="field">
        <label htmlFor="household">Household name</label>
        <input
          id="household"
          type="text"
          placeholder="Flat 4B"
          value={household}
          onChange={(e) => {
            setHousehold(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          type="text"
          placeholder="Ayoosh"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
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
                border: colour === c.hex ? '2px solid #22201d' : '2px solid transparent'
              }}
            />
          ))}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button onClick={submit} disabled={busy}>
        {busy ? 'Creating…' : 'Create household'}
      </button>
    </main>
  );
}
