import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Chorus',
  description: 'Household chores, fairly shared.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf9f7'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=document.cookie.match(/(?:^|; )chorus-theme=(\\w+)/);var c=t?t[1]:'system';var r=c==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light':c;document.documentElement.setAttribute('data-theme',r);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',r==='dark'?'#1a1918':'#faf9f7');}catch(e){}})()`
          }}
        />
        <meta name="theme-color" content="#faf9f7" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/chorus-touch.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/chorus-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Chorus" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
