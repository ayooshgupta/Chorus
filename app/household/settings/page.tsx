import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import AddMember from '../add-member';
import SettingsForm from './form';
import Nav from '../../nav';

export const dynamic = 'force-dynamic';

export default async function HouseholdSettings() {
  const session = await loadSession();
  if (!session) redirect('/setup');
  const me = session.active;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from('members')
    .select('id, display_name, email, colour, auth_user_id')
    .eq('household_id', me.household_id)
    .order('joined_at', { ascending: true });

  return (
    <>
      <main style={{ paddingTop: 30 }}>
        <a href="/household" className="back">
          ← Household
        </a>
        <h1>Household settings</h1>
        <div style={{ height: 10 }} />

        <SettingsForm currentName={me.householdName} />

        <h2 style={{ marginTop: 30 }}>Members</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          {(members ?? []).map((m) => (
            <div key={m.id} className="member-row">
              <div className="dot" style={{ background: m.colour }}>
                {m.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{m.display_name}</div>
                <div className="meta">{m.email}</div>
              </div>
              <span className="pill">{m.auth_user_id ? 'Signed up' : 'Invited'}</span>
            </div>
          ))}
        </div>

        <AddMember householdId={me.household_id} />
      </main>
      <Nav />
    </>
  );
}
