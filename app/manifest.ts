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
