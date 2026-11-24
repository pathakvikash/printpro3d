import type { MetadataRoute } from 'next';
import { CATALOG, shopVisible } from '@/lib/catalog';
import { TEMPLATES } from '@/lib/templateDefs';

// Public routes only: /admin and /api are left out on purpose.
const ROUTES = ['', '/quote', '/request', '/shop', '/build', '/track', '/materials', '/how-it-works', '/about', '/contact', ...shopVisible(CATALOG).map((i) => `/blueprint/${i.id}`), ...[...shopVisible(CATALOG), ...shopVisible(TEMPLATES)].map((i) => `/shop/${i.id}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL?.trim() || 'https://printpro3d.vercel.app').replace(/\/+$/, '');
  return ROUTES.map((r) => ({ url: `${base}${r}` }));
}
