import { ICON_192_B64 } from '@/lib/pwa-icons';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(Buffer.from(ICON_192_B64, 'base64'), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
