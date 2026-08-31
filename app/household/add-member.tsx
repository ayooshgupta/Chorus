'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBER_COLOURS } from '@/lib/config';
import { addMember } from './actions';

export default function AddMember({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [colour, setColour] = useState(MEMBER_COLOURS[1].hex);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError('Add a name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Add a valid email address.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await addMember({
      householdId,
      displayName: name.trim(),
      email: email.trim(),
      colour
    });
    setBusy(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setName('');
    setEmail('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        Add a member
      </button>
    );
  }

  return (
    <div className="card">
      <h2>Add a member</h2>

      <div className="field">
        <label htmlFor="m-name">Name</label>
        <input
          id="m-name"
          type="text"
          placeholder="Sara"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="m-email">Email</label>
        <input
          id="m-email"
          type="email"
          placeholder="sara@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      <div className="field">
        <span className="label">Colour</span>
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
        {busy ? 'Adding…' : 'Add member'}
      </button>
      <div style={{ height: 10 }} />
      <button className="ghost" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </button>
    </div>
  );
}
