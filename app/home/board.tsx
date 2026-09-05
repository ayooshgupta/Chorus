'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
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
  notes: string | null;
  dueOn: string;
  deferred: boolean;
  when: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerColour: string | null;
  dots: { colours: string[] }[];
};

type MemberLite = { id: string; name: string; colour: string };

const LABEL: Record<string, string> = {
  dedicated: 'One person',
  alternating: 'Take turns',
  adhoc: 'Anyone'
};

type Mode = 'all' | 'unassigned' | 'member';

export default function Board({
  tasks,
  sections,
  members,
  meId,
  weekendIso,
  householdId
}: {
  tasks: (Task & { bucket: Bucket })[];
  sections: { key: Bucket; label: string; late?: boolean }[];
  members: MemberLite[];
  meId: string;
  weekendIso: string;
  householdId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Task | null>(null);
  const [showHandOff, setShowHandOff] = useState(false);
  const [creditTo, setCreditTo] = useState<Set<string>>(new Set([meId]));
  const [gone, setGone] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('all');
  // The last member picked — kept even while Everyone/Unassigned is active,
  // so switching back to Member re-applies them without reopening the picker.
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterKey = `chorus-board-filter-${householdId}`;

  // Restore the last filter chosen on this device — only after mount, so the
  // server-rendered "Everyone" view never mismatches during hydration.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(filterKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { mode?: string; memberId?: string | null };
      const validMember =
        saved.memberId && members.some((m) => m.id === saved.memberId) ? saved.memberId : null;
      if (validMember) setMemberId(validMember);
      if (saved.mode === 'unassigned') setMode('unassigned');
      else if (saved.mode === 'member' && validMember) setMode('member');
    } catch {
      // localStorage unavailable, or nothing saved yet — stay on the default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  function persist(nextMode: Mode, nextMemberId: string | null) {
    try {
      window.localStorage.setItem(filterKey, JSON.stringify({ mode: nextMode, memberId: nextMemberId }));
    } catch {
      // ignore — filter still applies for this visit
    }
  }

  function chooseAll() {
    setMode('all');
    setPickerOpen(false);
    persist('all', memberId);
  }

  function chooseUnassigned() {
    setMode('unassigned');
    setPickerOpen(false);
    persist('unassigned', memberId);
  }

  function chooseMember(id: string) {
    setMode('member');
    setMemberId(id);
    setPickerOpen(false);
    persist('member', id);
  }

  function tapMemberSegment() {
    if (mode === 'member') {
      setPickerOpen((o) => !o);
    } else {
      chooseMember(memberId ?? meId);
    }
  }

  function nameFor(id: string) {
    const m = members.find((mm) => mm.id === id);
    if (!m) return 'Member';
    return id === meId ? `${m.name} (you)` : m.name;
  }

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
    setCreditTo(new Set([meId]));
    setShowHandOff(false);
    setOpen(task);
  }

  function toggleCredit(memberId: string) {
    setCreditTo((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        if (next.size > 1) next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
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
  const filtered = visible.filter((t) => {
    if (mode === 'all') return true;
    if (mode === 'unassigned') return t.ownerId === null;
    return t.ownerId === memberId;
  });

  const filteredCount = filtered.length;
  const thing = filteredCount === 1 ? 'thing' : 'things';
  let stat: string;
  if (mode === 'all') {
    stat = filteredCount === 0 ? 'Nothing due. Enjoy it.' : `${filteredCount} ${thing} to get to`;
  } else if (mode === 'unassigned') {
    stat =
      filteredCount === 0
        ? "Nothing's unclaimed."
        : `${filteredCount} ${thing} need${filteredCount === 1 ? 's' : ''} a taker`;
  } else {
    const person = memberId === meId ? 'you' : (members.find((m) => m.id === memberId)?.name ?? 'them');
    stat = filteredCount === 0 ? `Nothing for ${person}.` : `${filteredCount} ${thing} for ${person}`;
  }

  return (
    <>
      <p className="sub" style={{ margin: '0 0 14px' }}>
        {stat}
      </p>

      <div className="seg" style={{ marginBottom: 20 }}>
        <button type="button" data-on={mode === 'all'} onClick={chooseAll}>
          Everyone
        </button>
        <button type="button" data-on={mode === 'member'} onClick={tapMemberSegment}>
          {memberId ? nameFor(memberId) : 'Member'}
          {mode === 'member' ? <span className="chev">▾</span> : null}
        </button>
        <button type="button" data-on={mode === 'unassigned'} onClick={chooseUnassigned}>
          Unassigned
        </button>

        {pickerOpen ? (
          <>
            <div className="member-popover-catcher" onClick={() => setPickerOpen(false)} />
            <div className="member-popover">
              <div className="member-popover-grid">
                {members.map((m) => (
                  <button
                    key={m.id}
                    className="house-row"
                    data-on={memberId === m.id}
                    onClick={() => chooseMember(m.id)}
                  >
                    {nameFor(m.id)}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {filteredCount === 0 ? (
        <div className="card">
          <div className="empty">Nothing due right now.</div>
        </div>
      ) : (
        sections.map((section) => {
          const items = filtered.filter((t) => t.bucket === section.key);
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
                    onClick={() =>{
                      const myName = members.find((m) => m.id === meId)?.name ?? 'you';
                      act(task.id, () => completeTask(task.id, [meId]), true, {
                        id: task.id,
                        label: task.name,
                        by: myName,
                        kind: 'completed'
                      });
                    }}
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
                    {task.dots.length > 0 ? (
                      <div className="trend">
                        {task.dots.map((d, i) =>
                          d.colours.length > 1 ? (
                            <svg key={i} width="8" height="8" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="4" fill={d.colours[0]} />
                              <path d="M4 0 A4 4 0 0 1 4 8" fill={d.colours[1]} />
                              {d.colours[2] ? (
                                <path d="M4 0 L4 4 L7.46 2.27 A4 4 0 0 0 4 0 Z" fill={d.colours[2]} />
                              ) : null}
                            </svg>
                          ) : d.colours.length === 1 ? (
                            <span key={i} style={{ background: d.colours[0] }} />
                          ) : (
                            <span
                              key={i}
                              style={{ background: 'transparent', border: '1px solid var(--line-strong)' }}
                            />
                          )
                        )}
                      </div>
                    ) : null}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
        })
      )}

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
            <div className="meta" style={{ marginBottom: open.notes ? 12 : 16 }}>
              {open.ownerName ?? 'Anyone'} · {LABEL[open.assignment]} · {open.when}
              {open.room ? ` · ${open.room}` : ''}
            </div>

            {open.notes ? (
              <div className="sheet-note" style={{ marginBottom: 16 }}>
                <span className="sheet-note-label">Note</span>
                {open.notes}
              </div>
            ) : null}

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
                    <span className="label">Who did it</span>
                    <div className="seg" style={{ marginBottom: 14 }}>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          data-on={creditTo.has(m.id)}
                          onClick={() => toggleCredit(m.id)}
                        >
                          {m.name}{creditTo.has(m.id) ? ' ✓' : ''}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="sheet-actions">
                  <button
                    onClick={() => {
                      const ids = Array.from(creditTo);
                      const names = ids.map((id) => members.find((m) => m.id === id)?.name ?? '').filter(Boolean);
                      act(open.id, () => completeTask(open.id, ids), true, {
                        id: open.id,
                        label: open.name,
                        by: names.join(' + '),
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
