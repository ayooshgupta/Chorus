'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { renameHousehold } from '../actions';

export default function SettingsForm({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (name.trim() === currentName) return;
    setBusy(true);
    setError(null);
    const result = await renameHousehold(name);
    setBusy(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card">
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="h-name">Household name</label>
        <input
          id="h-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button onClick={save} disabled={busy || name.trim() === currentName}>
        {busy ? 'Saving…' : saved ? 'Saved' : 'Save name'}
      </button>
    </div>
  );
}
