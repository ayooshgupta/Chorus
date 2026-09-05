'use client';

import { useRouter } from 'next/navigation';

export default function SettingsBackButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  function back() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button type="button" className="back" onClick={back} aria-label="Back">
      ←
    </button>
  );
}
