'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Bucket } from '@/lib/recurrence';
import { AssignmentIcon } from '@/lib/icons';
import { completeTask, skipTask, deferTask, handOffTask, undoComplete, undoSkip } from './actions';

type ToastData = {
  id: string;
  label: string;
  by: string;
  kind: 'completed' | 'skipped';
};

export type Task = {
  id: string;
  choreId: string;
  name: string;
  assignment: string;
  weight: number;
  room: string | null;
  dueOn: string;
  deferred: boolean;
  when: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerColour: string | null;
};

type MemberLite = { id: string; name: string; colour: string };

const LABEL: Record<string, string> = {
  dedicated: 'One person',
  alternating: 'Take turns',
  adhoc: 'Anyone'
};

export default function Board({
  tasks,
  sections,
  members,
  meId,
  weekendIso
}: {
  tasks: (Task & { bucket: Bucket })[];
  sections: { key: Bucket; label: string; late?: boolean }[];
  members: MemberLite[];
  meId: string;
  weekendIso: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Task | null>(null);
  const [showHandOff, setShowHandOff] = useState(false);
  const [creditTo, setCreditTo] = useState(meId);
  const [gone, setGone] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(data: ToastData) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(data);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  function handleUndo() {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const t = toast;
    setToast(null);
    setGone((g) => g.filter((id) => id !== t.id));
    startTransition(async () => {
      if (t.kind === 'completed') await undoComplete(t.id);
      else await undoSkip(t.id);
      router.refresh();
    });
  }

  function openSheet(task: Task) {
    setCreditTo(meId);
    setShowHandOff(false);
    setOpen(task);
  }

  function act(taskId: string, fn: () => Promise<unknown>, removes = true, toastData?: ToastData) {
    if (removes) setGone((g) => [...g, taskId]);
    setOpen(null);
    setShowHandOff(false);
    if (toastData) showToast(toastData);

    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const visible = tasks.filter((t) => !gone.includes(t.id));

  if (visible.length === 0) {
    return (
      <div className="card">
        <div className="empty">Nothing due right now.</div>
      </div>
    );
  }

  return (
    <>
      {sections.map((section) => {
        const items = visible.filter((t) => t.bucket === section.key);
        if (items.length === 0) return null;

        return (
          <div key={section.key}>
            <div className={section.late ? 'section-label late' : 'section-label'}>
              {section.label}
            </div>
            <div className="card">
              {items.map((task) => (
                <div key={task.id} className="task">
                  <button
                    className="tick"
                    aria-label={`Complete ${task.name}`}
                    onClick={() =>
                      act(task.id, () => completeTask(task.id), true, {
                        id: task.id,
                        label: task.name,
                        by: task.ownerName ?? 'you',
                        kind: 'completed'
                      })
                    }
                  >
                    <span
                      className="ring"
                      style={
                        task.ownerColour
                          ? {
                              background: `${task.ownerColour}1f`,
                              border: `1.5px solid ${task.ownerColour}`,
                              color: task.ownerColour
                            }
                          : {
                              border: '1.5px dashed var(--line-strong)',
                              color: 'var(--text-faint)'
                            }
                      }
                    >
                      {task.ownerName ? task.ownerName.slice(0, 1).toUpperCase() : ''}
                    </span>
                  </button>

                  <button className="task-body" onClick={() => openSheet(task)}>
                    <span className="name-line">
                      <AssignmentIcon kind={task.assignment} />
                      {task.name}
                    </span>
                    <div className="meta">
                      {task.ownerName ? `${task.ownerName} · ` : 'Anyone · '}
                      {task.when}
                      {task.room ? ` · ${task.room}` : ''}
                      {task.deferred ? ' · deferred' : ''}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {open ? (
        <div
          className="scrim"
          onClick={() => {
            setOpen(null);
            setShowHandOff(false);
          }}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div style={{ fontSize: 18, fontWeight: 600 }}>{open.name}</div>
            <div className="meta" style={{ marginBottom: 16 }}>
              {open.ownerName ?? 'Anyone'} · {LABEL[open.assignment]} · {open.when}
              {open.room ? ` · ${open.room}` : ''}
            </div>

            {showHandOff ? (
              <>
                <span className="label">Hand this one to</span>
                <div className="tiles" style={{ marginBottom: 12 }}>
                  {members
                    .filter((m) => m.id !== open.ownerId)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => act(open.id, () => handOffTask(open.id, m.id), false)}
                      >
                        {m.name}
                      </button>
                    ))}
                </div>
                <button className="ghost" onClick={() => setShowHandOff(false)}>
                  Back
                </button>
              </>
            ) : (
              <>
                {members.length > 1 ? (
                  <>
                    <span className="label">Completed by</span>
                    <div className="seg" style={{ marginBottom: 14 }}>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          data-on={creditTo === m.id}
                          onClick={() => setCreditTo(m.id)}
                        >
                          {m.id === meId ? `${m.name} (you)` : m.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="sheet-actions">
                  <button
                    onClick={() => {
                      const creditName = members.find((m) => m.id === creditTo)?.name ?? 'you';
                      act(open.id, () => completeTask(open.id, creditTo), true, {
                        id: open.id,
                        label: open.name,
                        by: creditName,
                        kind: 'completed'
                      });
                    }}
                  >
                    Complete
                  </button>
                  <button
                    onClick={() =>
                      act(open.id, () => skipTask(open.id), true, {
                        id: open.id,
                        label: open.name,
                        by: '',
                        kind: 'skipped'
                      })
                    }
                  >
                    Skip
                  </button>
                  <button onClick={() => setShowHandOff(true)}>Hand off</button>
                  <button onClick={() => act(open.id, () => deferTask(open.id, 1))}>Defer</button>
                </div>

                <span className="label" style={{ marginTop: 16 }}>
                  Defer until
                </span>
                <div className="seg">
                  <button onClick={() => act(open.id, () => deferTask(open.id, 1))}>Tomorrow</button>
                  <button onClick={() => act(open.id, () => deferTask(open.id, 3))}>
                    In 3 days
                  </button>
                  <button onClick={() => act(open.id, () => deferTask(open.id, 0, weekendIso))}>
                    Weekend
                  </button>
                </div>

                <p className="hint">
                  Skip means this round was not needed. The turn still passes on.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast">
          <div>
            <div className="toast-label">
              {toast.label} {toast.kind === 'completed' ? 'completed' : 'skipped'}
            </div>
            {toast.by ? <div className="toast-meta">by {toast.by}</div> : null}
          </div>
          <button className="toast-undo" onClick={handleUndo}>
            Undo
          </button>
        </div>
      ) : null}
    </>
  );
}
