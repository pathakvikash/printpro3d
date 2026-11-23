import type { MetadataRoute } from 'next';
import { CATALOG } from '@/lib/catalog';

// Public routes only: /admin and /api are left out on purpose.
const ROUTES = ['', '/quote', '/request', '/shop', '/build', '/track', '/materials', '/motor-test', '/how-it-works', '/about', '/contact', ...CATALOG.map((i) => `/blueprint/${i.id}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL?.trim() || 'https://printpro3d.vercel.app').replace(/\/+$/, '');
  return ROUTES.map((r) => ({ url: `${base}${r}` }));
}
