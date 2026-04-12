import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Agendo',
    short_name: 'Agendo',
    description: 'Web app premium de productividad construida con Next.js.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    shortcuts: [
      {
        name: 'Start next block',
        short_name: 'Start',
        description: 'Open Agendo ready to start the next block.',
        url: '/?habit=start',
        icons: [{ src: '/app-icon.jpg', sizes: '192x192', type: 'image/jpeg' }],
      },
      {
        name: 'Rescue my day',
        short_name: 'Rescue',
        description: 'Open quick rescue and re-order the day.',
        url: '/?habit=rescue',
        icons: [{ src: '/app-icon.jpg', sizes: '192x192', type: 'image/jpeg' }],
      },
      {
        name: 'Widget view',
        short_name: 'Widget',
        description: 'Compact next-block view for fast opening.',
        url: '/widget',
        icons: [{ src: '/app-icon.jpg', sizes: '192x192', type: 'image/jpeg' }],
      },
    ],
    icons: [
      {
        src: '/app-icon.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/app-icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}
