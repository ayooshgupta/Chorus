import { redirect } from 'next/navigation';
import { loadSession } from '@/lib/session';
import ProfileSettings from './profile-settings';
import BackButton from './back-button';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await loadSession();
  if (!session) redirect('/setup');

  return (
    <>
      <main style={{ paddingTop: 30 }}>
        <BackButton fallback="/home" />
        <h1 style={{ marginTop: 6 }}>Settings</h1>
        <div style={{ height: 10 }} />

        <ProfileSettings
          email={session.email}
          avatarUrl={session.avatarUrl}
          active={session.active}
          memberships={session.memberships}
        />
      </main>
      <Nav />
    </>
  );
}
