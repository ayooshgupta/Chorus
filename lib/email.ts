import nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = process.env.GMAIL_USER;
  const tx = getTransporter();
  if (!tx || !user) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD are not set' };

  try {
    await tx.sendMail({
      from: `Chorus <${user}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error sending email' };
  }
}

export function buildInviteEmail(input: {
  displayName: string;
  householdName: string;
  addedByName: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const name = input.displayName;
  const household = input.householdName;
  const adder = input.addedByName;
  const url = input.appUrl;

  const subject = `You're on Chorus — ${household}`;
  const year = new Date().getFullYear();

  const text = `Chorus

Hi ${name},

${adder} added you to ${household} on Chorus — the app they're using to keep track of shared housework so it's not all living in one person's head.

Here's the link: ${url}

It's got the daily and weekly stuff loaded already. Chores marked "take turns" rotate automatically each week, so nobody gets stuck with the same job forever. No scoring, no leaderboard — just a shared list.

A few minutes to set up:

1. Sign in
Open the link and sign in with this email address — either the Google button or the emailed link both work.

2. Add it to your Home Screen (do this before notifications)
Open the link in Safari — this bit doesn't work in Chrome.
- Tap the Share button (the square with the arrow)
- Scroll down and tap Add to Home Screen
- Tap Add

From now on, open Chorus from that home screen icon rather than the browser — it looks and behaves like a proper app.

3. Turn on notifications
Open Chorus from the home screen icon (this matters — the option won't show up otherwise).
- Tap your profile picture, top right
- Scroll to Notifications
- Switch it on and tap Allow

Tap any chore to see what it actually involves — most have a short checklist in the notes so there's no guessing what "done" means.

Questions? Ask ${adder}.

—
Designed by APVS Consulting Pty Ltd · © ${year} All rights reserved.`;

  const n = escapeHtml(name);
  const h = escapeHtml(household);
  const a = escapeHtml(adder);
  const u = escapeHtml(url);

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px;color:#22201d;">
  <div style="text-align:center;margin:0 0 28px;">
    <img src="${u.replace(/\/$/, '')}/chorus-192.png" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border-radius:9px;margin-right:8px;">
    <span style="display:inline-block;vertical-align:middle;font-size:17px;font-weight:600;color:#22201d;">Chorus</span>
  </div>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${n},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;"><strong>${a}</strong> added you to <strong>${h}</strong> on Chorus — the app they're using to keep track of shared housework so it's not all living in one person's head.</p>
  <p style="margin:0 0 20px;"><a href="${u}" style="display:inline-block;background:#1d9e75;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px;">Open Chorus</a></p>
  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 24px;">It's got the daily and weekly stuff loaded already. Chores marked &quot;take turns&quot; rotate automatically each week, so nobody gets stuck with the same job forever. No scoring, no leaderboard — just a shared list.</p>

  <p style="font-size:15px;font-weight:600;margin:0 0 8px;">1. Sign in</p>
  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 20px;">Open the link and sign in with this email address — either the Google button or the emailed link both work.</p>

  <p style="font-size:15px;font-weight:600;margin:0 0 8px;">2. Add it to your Home Screen <span style="font-weight:400;color:#6b6862;">(do this before notifications)</span></p>
  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 8px;">Open the link in <strong>Safari</strong> — this bit doesn't work in Chrome.</p>
  <ul style="font-size:14px;line-height:1.7;color:#6b6862;margin:0 0 20px;padding-left:20px;">
    <li>Tap the Share button (the square with the arrow)</li>
    <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
    <li>Tap <strong>Add</strong></li>
  </ul>
  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 20px;">From now on, open Chorus from that home screen icon rather than the browser — it looks and behaves like a proper app.</p>

  <p style="font-size:15px;font-weight:600;margin:0 0 8px;">3. Turn on notifications</p>
  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 8px;">Open Chorus <strong>from the home screen icon</strong> (this matters — the option won't show up otherwise).</p>
  <ul style="font-size:14px;line-height:1.7;color:#6b6862;margin:0 0 24px;padding-left:20px;">
    <li>Tap your profile picture, top right</li>
    <li>Scroll to <strong>Notifications</strong></li>
    <li>Switch it on and tap <strong>Allow</strong></li>
  </ul>

  <p style="font-size:14px;line-height:1.6;color:#6b6862;margin:0 0 20px;">Tap any chore to see what it actually involves — most have a short checklist in the notes so there's no guessing what &quot;done&quot; means.</p>

  <p style="font-size:13px;color:#9b978f;margin:24px 0 0;">Questions? Ask ${a}.</p>

  <p style="font-size:11px;color:#9b978f;text-align:center;margin:32px 0 0;padding-top:16px;border-top:1px solid rgba(34,32,29,0.1);">Designed by APVS Consulting Pty Ltd · © ${year} All rights reserved.</p>
</div>`;

  return { subject, html, text };
}
