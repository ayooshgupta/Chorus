'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveMember } from '../actions';

type Member = {
  id: string;
  display_name: string;
  email: string;
  colour: string;
  auth_user_id: string | null;
};

export default function MemberList({ members, meId }: { members: Member[]; meId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  function handleArchive(memberId: string) {
    setConfirm(null);
    startTransition(async () => {
      await archiveMember(memberId);
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {members.map((m) => (
        <div key={m.id}>
          <div className="member-row">
            <div className="dot" style={{ background: m.colour }}>
              {m.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{m.display_name}</div>
              <div className="meta">{m.email}</div>
            </div>
            {m.id === meId ? (
              <span className="pill">You</span>
            ) : (
              <button
                type="button"
                className="link-btn"
                style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                onClick={() => setConfirm(m.id)}
              >
                Archive
              </button>
            )}
          </div>
          {confirm === m.id ? (
            <div style={{ padding: '8px 0 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-soft)', flex: 1 }}>
                Remove {m.display_name} from chores? History stays.
              </span>
              <button
                type="button"
                className="danger"
                style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                onClick={() => handleArchive(m.id)}
              >
                Confirm
              </button>
              <button
                type="button"
                className="ghost"
                style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
