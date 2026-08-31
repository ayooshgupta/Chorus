export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://trijworqombajiutmfcx.supabase.co';

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_cW1KA7FF-q42vRIwTOaX5w_Lh2e67tW';

export const HOUSEHOLD_TZ = 'Australia/Sydney';
export const ACTIVE_HOUSEHOLD_COOKIE = 'chorus_household';

export type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export const MEMBER_COLOURS = [
  { name: 'Teal', hex: '#1D9E75' },
  { name: 'Coral', hex: '#D85A30' },
  { name: 'Blue', hex: '#378ADD' },
  { name: 'Purple', hex: '#7F77DD' },
  { name: 'Pink', hex: '#D4537E' },
  { name: 'Amber', hex: '#BA7517' },
  { name: 'Green', hex: '#639922' },
  { name: 'Slate', hex: '#5F5E5A' }
];
