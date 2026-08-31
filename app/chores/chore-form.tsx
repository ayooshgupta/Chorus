'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EFFORTS,
  WEEKDAY_SHORT,
  describe,
  nthLabel,
  nthOfMonth,
  ordinal,
  parseDate,
  shortDate,
  todayIso,
  WEEKDAY_NAME,
  type Assignment,
  type Freq,
  type MonthlyPattern
} from '@/lib/recurrence';
import { saveChore, archiveChore } from './actions';

export type MemberOption = { id: string; display_name: string; colour: string };

export type HistoryEntry = {
  date: string;
  status: string;
  who: string | null;
  colour: string | null;
};

export type ChoreDraft = {
  id?: string;
  name: string;
  room: string;
  notes: string;
  freq: Freq;
  interval: number;
  byweekday: number[];
  monthlyPattern: MonthlyPattern;
  anchor: string;
  weight: number;
  assignment: Assignment;
  dedicatedMemberId: string | null;
  rotationMemberIds: string[];
};

type Mode = 'daily' | 'weekly' | 'monthly' | 'every';
type EveryUnit = 'days' | 'weeks' | 'months';

export default function ChoreForm({
  members,
  knownRooms,
  history,
  initial
}: {
  members: MemberOption[];
  knownRooms: string[];
  history: HistoryEntry[];
  initial: ChoreDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChoreDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(Boolean(initial.notes));

  const initialMode: Mode =
    initial.interval > 1
      ? 'every'
      : initial.freq === 'daily'
        ? 'daily'
        : initial.freq === 'weekly'
          ? 'weekly'
          : 'monthly';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [unit, setUnit] = useState<EveryUnit>(
    initial.freq === 'daily' ? 'days' : initial.freq === 'weekly' ? 'weeks' : 'months'
  );

  const anchorDate = useMemo(() => parseDate(draft.anchor), [draft.anchor]);
  const lastDone = history.find((h) => h.status === 'done');

  function set<K extends keyof ChoreDraft>(key: K, value: ChoreDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (error) setError(null);
  }

  function chooseMode(next: Mode) {
    setMode(next);
    if (next === 'daily') setDraft((d) => ({ ...d, freq: 'daily', interval: 1, byweekday: [] }));
    if (next === 'weekly')
      setDraft((d) => ({
        ...d,
        freq: 'weekly',
        interval: 1,
        byweekday: d.byweekday.length ? d.byweekday : [parseDate(d.anchor).getDay()]
      }));
    if (next === 'monthly') setDraft((d) => ({ ...d, freq: 'monthly', interval: 1, byweekday: [] }));
    if (next === 'every') {
      setUnit('days');
      setDraft((d) => ({ ...d, freq: 'daily', interval: Math.max(d.interval, 2), byweekday: [] }));
    }
  }

  function chooseUnit(next: EveryUnit) {
    setUnit(next);
    if (next === 'days') setDraft((d) => ({ ...d, freq: 'daily', byweekday: [] }));
    if (next === 'weeks')
      setDraft((d) => ({
        ...d,
        freq: 'weekly',
        byweekday: d.byweekday.length ? d.byweekday : [parseDate(d.anchor).getDay()]
      }));
    if (next === 'months') setDraft((d) => ({ ...d, freq: 'monthly', byweekday: [] }));
  }

  function toggleDay(day: number) {
    setDraft((d) => {
      const on = d.byweekday.includes(day);
      const next = on ? d.byweekday.filter((x) => x !== day) : [...d.byweekday, day];
      return { ...d, byweekday: next.sort((a, b) => a - b) };
    });
    if (error) setError(null);
  }

  function toggleRotation(id: string) {
    setDraft((d) => {
      const on = d.rotationMemberIds.includes(id);
      return {
        ...d,
        rotationMemberIds: on
          ? d.rotationMemberIds.filter((x) => x !== id)
          : [...d.rotationMemberIds, id]
      };
    });
    if (error) setError(null);
  }

  const showDays = draft.freq === 'weekly';
  const showMonthly = draft.freq === 'monthly';

  async function submit() {
    if (!draft.name.trim()) {
      setError('Give the chore a name.');
      return;
    }
    if (draft.freq === 'weekly' && draft.byweekday.length === 0) {
      setError('Pick at least one day.');
      return;
    }
    if (draft.assignment === 'dedicated' && !draft.dedicatedMemberId) {
      setError('Choose who this belongs to.');
      return;
    }
    if (draft.assignment === 'alternating' && draft.rotationMemberIds.length < 2) {
      setError('Taking turns needs at least two people.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await saveChore({
      ...draft,
      name: draft.name.trim(),
      room: draft.room.trim(),
      notes: showNotes ? draft.notes.trim() : ''
    });
    setBusy(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push('/household');
    router.refresh();
  }

  async function remove() {
    if (!draft.id) return;
    setBusy(true);
    const result = await archiveChore(draft.id);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push('/household');
    router.refresh();
  }

  return (
    <main style={{ paddingTop: 30 }}>
      <a href="/household" className="back">
        ←
      </a>
      <h1 style={{ marginTop: 6 }}>{draft.id ? 'Edit chore' : 'New chore'}</h1>
      {draft.id ? (
        <p className="sub">
          {lastDone
            ? `Last done ${shortDate(lastDone.date)}${lastDone.who ? ` by ${lastDone.who}` : ''}`
            : 'Not done yet'}
        </p>
      ) : (
        <div style={{ height: 18 }} />
      )}

      <div className="field">
        <label htmlFor="c-name">Name</label>
        <input
          id="c-name"
          type="text"
          placeholder="Take bins out"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="field">
        <span className="label">Repeats</span>
        <div className="seg">
          {(['daily', 'weekly', 'monthly', 'every'] as Mode[]).map((m) => (
            <button key={m} type="button" data-on={mode === m} onClick={() => chooseMode(m)}>
              {m === 'daily'
                ? 'Daily'
                : m === 'weekly'
                  ? 'Weekly'
                  : m === 'monthly'
                    ? 'Monthly'
                    : 'Every'}
            </button>
          ))}
        </div>

        {mode === 'every' ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <input
              type="number"
              min={2}
              max={60}
              value={draft.interval}
              onChange={(e) => set('interval', Math.max(2, Number(e.target.value) || 2))}
              style={{ width: 70 }}
            />
            <div className="seg" style={{ flex: 1 }}>
              {(['days', 'weeks', 'months'] as EveryUnit[]).map((u) => (
                <button key={u} type="button" data-on={unit === u} onClick={() => chooseUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showDays ? (
          <div className="days" style={{ marginTop: 10 }}>
            {WEEKDAY_SHORT.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-label={WEEKDAY_NAME[i]}
                data-on={draft.byweekday.includes(i)}
                onClick={() => toggleDay(i)}
              >
                {d}
              </button>
            ))}
          </div>
        ) : null}

        {showMonthly ? (
          <div className="seg" style={{ marginTop: 10 }}>
            <button
              type="button"
              data-on={draft.monthlyPattern === 'day_of_month'}
              onClick={() => set('monthlyPattern', 'day_of_month')}
            >
              On the {ordinal(anchorDate.getDate())}
            </button>
            <button
              type="button"
              data-on={draft.monthlyPattern === 'nth_weekday'}
              onClick={() => set('monthlyPattern', 'nth_weekday')}
            >
              {nthLabel(nthOfMonth(anchorDate))} {WEEKDAY_NAME[anchorDate.getDay()]}
            </button>
          </div>
        ) : null}

        <p className="hint">
          {describe({
            freq: draft.freq,
            interval: draft.interval,
            byweekday: draft.byweekday,
            monthlyPattern: draft.monthlyPattern,
            anchor: draft.anchor
          })}
        </p>
      </div>

      <div className="field">
        <label htmlFor="c-anchor">Starts</label>
        <input
          id="c-anchor"
          type="date"
          value={draft.anchor}
          onChange={(e) => set('anchor', e.target.value || todayIso())}
        />
      </div>

      <div className="field">
        <span className="label">Effort</span>
        <div className="seg">
          {EFFORTS.map((e) => (
            <button
              key={e.weight}
              type="button"
              data-on={draft.weight === e.weight}
              onClick={() => set('weight', e.weight)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Who does it</span>
        <div className="tiles">
          <button
            type="button"
            data-on={draft.assignment === 'dedicated'}
            onClick={() => set('assignment', 'dedicated')}
          >
            One person
          </button>
          <button
            type="button"
            data-on={draft.assignment === 'alternating'}
            onClick={() => set('assignment', 'alternating')}
          >
            Take turns
          </button>
          <button
            type="button"
            data-on={draft.assignment === 'adhoc'}
            onClick={() => set('assignment', 'adhoc')}
          >
            Anyone
          </button>
        </div>

        {draft.assignment === 'dedicated' ? (
          <div className="tiles" style={{ marginTop: 10 }}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                data-on={draft.dedicatedMemberId === m.id}
                onClick={() => set('dedicatedMemberId', m.id)}
              >
                {m.display_name}
              </button>
            ))}
          </div>
        ) : null}

        {draft.assignment === 'alternating' ? (
          <div className="tiles" style={{ marginTop: 10 }}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                data-on={draft.rotationMemberIds.includes(m.id)}
                onClick={() => toggleRotation(m.id)}
              >
                {m.display_name}
              </button>
            ))}
          </div>
        ) : null}

        {draft.assignment === 'adhoc' ? (
          <p className="hint">Nobody is assigned. Whoever gets to it takes the credit.</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="c-room">Room (optional)</label>
        <input
          id="c-room"
          type="text"
          placeholder="Kitchen"
          value={draft.room}
          onChange={(e) => set('room', e.target.value)}
        />
        {knownRooms.length ? (
          <div className="chips">
            {knownRooms.map((r) => (
              <button
                key={r}
                type="button"
                data-on={draft.room.trim().toLowerCase() === r.toLowerCase()}
                onClick={() =>
                  set('room', draft.room.trim().toLowerCase() === r.toLowerCase() ? '' : r)
                }
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="field">
        {showNotes ? (
          <>
            <label htmlFor="c-notes">Notes (optional)</label>
            <textarea
              id="c-notes"
              placeholder="Filter is under the sink, spare bags in the cupboard…"
              value={draft.notes}
              maxLength={500}
              onChange={(e) => set('notes', e.target.value)}
            />
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowNotes(true)}>
            + Add a note
          </button>
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add chore'}
      </button>

      {draft.id && history.length ? (
        <>
          <h2 style={{ marginTop: 30 }}>History</h2>
          <div className="card">
            {history.map((h, i) => (
              <div key={i} className="hist-row">
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    flex: 'none',
                    background: h.colour ?? 'transparent',
                    border: h.colour ? 'none' : '1px solid var(--line-strong)'
                  }}
                />
                <span style={{ flex: 1 }}>{shortDate(h.date)}</span>
                <span className="meta">{h.status === 'done' ? (h.who ?? 'Done') : 'Skipped'}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {draft.id ? (
        <>
          <div style={{ height: 16 }} />
          <button className="danger" onClick={remove} disabled={busy}>
            Archive this chore
          </button>
          <p className="hint">Archiving hides it from the list but keeps its history.</p>
        </>
      ) : null}
    </main>
  );
}
