import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/config';

// Service-role client — bypasses RLS. Server-only. Used by the daily-reminder
// cron to read occurrences and push subscriptions across every household.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
