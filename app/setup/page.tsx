import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSession } from '@/lib/session';
import SetupForm from './form';

export const dynamic = 'force-dynamic';

export default async function Setup({
  searchParams
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const session = await loadSession();
  if (session && params.new !== '1') redirect('/home');

  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : '';

  return (
    <SetupForm
      email={user.email ?? ''}
      suggestedName={session?.active.display_name ?? fullName.split(' ')[0] ?? ''}
      another={Boolean(session)}
    />
  );
}
