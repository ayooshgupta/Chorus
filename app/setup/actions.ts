'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

export async function createHousehold(input: {
  householdName: string;
  displayName: string;
  colour: string;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: 'You are not signed in.' };

  const { data, error } = await supabase.rpc('create_household', {
    p_household_name: input.householdName,
    p_display_name: input.displayName,
    p_colour: input.colour
  });

  if (error) return { error: error.message };

  if (typeof data === 'string') {
    const store = await cookies();
    store.set(ACTIVE_HOUSEHOLD_COOKIE, data, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax'
    });
  }

  redirect('/home');
}
