'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withGoogle() {
    setGoogleBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });

    if (err) {
      setError(err.message);
      setGoogleBusy(false);
    }
  }

  async function send() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });

    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <main style={{ paddingTop: 40 }}>
        <h1>Check your email</h1>
        <p className="sub">
          A sign-in link is on its way to {email.trim()}. Open it on this device and you will be
          signed straight in.
        </p>
        <button className="ghost" onClick={() => setSent(false)}>
          Back
        </button>
      </main>
    );
  }

  return (
    <main style={{ paddingTop: 40 }}>
      <h1>Chorus</h1>
      <p className="sub">Household chores, fairly shared.</p>

      <button className="google" onClick={withGoogle} disabled={googleBusy}>
        <GoogleMark />
        {googleBusy ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <div className="divider">or use your email</div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button className="ghost" onClick={send} disabled={busy}>
        {busy ? 'Sending…' : 'Send a sign-in link'}
      </button>
    </main>
  );
}
