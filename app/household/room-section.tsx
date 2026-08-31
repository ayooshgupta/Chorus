'use client';

import { useEffect, useState } from 'react';
import { Chevron } from '@/lib/icons';

export default function RoomSection({
  label,
  count,
  children
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const key = `chorus_room_${label.toLowerCase()}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(key) === 'closed') setOpen(false);
    } catch {
      // storage unavailable; leave expanded
    }
  }, [key]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(key, next ? 'open' : 'closed');
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <button className="room-head" onClick={toggle} aria-expanded={open}>
        <Chevron open={open} />
        {label}
        <span className="count">{count}</span>
        <span className="rule" />
      </button>
      {open ? <div className="card">{children}</div> : null}
    </div>
  );
}
