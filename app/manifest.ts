import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chorus',
    short_name: 'Chorus',
    description: 'Household chores, fairly shared.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9f7',
    theme_color: '#1D9E75',
    icons: [
      { src: '/chorus-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/chorus-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  };
}
