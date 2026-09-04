import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import AddMember from '../add-member';
import SettingsForm from './form';
import MemberList from './member-list';
import Nav from '../../nav';

export const dynamic = 'force-dynamic';

export default async function HouseholdSettings() {
  const session = await loadSession();
  if (!session) redirect('/setup');
  const me = session.active;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from('members')
    .select('id, display_name, email, colour, auth_user_id, archived_at')
    .eq('household_id', me.household_id)
    .order('joined_at', { ascending: true });

  const active = (members ?? []).filter((m) => !m.archived_at);
  const archived = (members ?? []).filter((m) => m.archived_at);

  return (
    <>
      <main style={{ paddingTop: 30 }}>
        <a href="/household" className="back">
          ←
        </a>
        <h1 style={{ marginTop: 6 }}>Settings</h1>
        <div style={{ height: 10 }} />

        <SettingsForm currentName={me.householdName} />

        <h2 style={{ marginTop: 30 }}>Members</h2>
        <MemberList members={active} meId={me.id} />

        <AddMember householdId={me.household_id} />

        {archived.length > 0 ? (
          <>
            <h2 style={{ marginTop: 30 }}>Archived</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              {archived.map((m) => (
                <div key={m.id} className="member-row" style={{ opacity: 0.55 }}>
                  <div className="dot" style={{ background: m.colour }}>
                    {m.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{m.display_name}</div>
                    <div className="meta">{m.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </main>
      <Nav />
    </>
  );
}
