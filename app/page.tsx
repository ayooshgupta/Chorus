import { redirect } from 'next/navigation';
import { loadSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const session = await loadSession();
  if (!session) redirect('/setup');
  redirect('/home');
}
