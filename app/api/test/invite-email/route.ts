import { NextResponse, type NextRequest } from 'next/server';
import { buildInviteEmail, sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-off way to preview the invite email without adding (and being stuck
// with) a real member row. Protected by the same CRON_SECRET already used
// for the daily-reminder test.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const to = req.nextUrl.searchParams.get('to');
  if (!to) return NextResponse.json({ error: 'Add ?to=your@email.com' }, { status: 400 });

  const { subject, html, text } = buildInviteEmail({
    displayName: req.nextUrl.searchParams.get('name') || 'Test',
    householdName: req.nextUrl.searchParams.get('household') || 'Your Household',
    addedByName: req.nextUrl.searchParams.get('adder') || 'You',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://chorus-apvs-consulting.vercel.app'
  });

  const result = await sendEmail({ to, subject, html, text });
  return NextResponse.json(result);
}
