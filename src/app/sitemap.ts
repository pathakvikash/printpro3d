import type { MetadataRoute } from 'next';
import { CATALOG, shopVisible } from '@/lib/catalog';
import { TEMPLATES } from '@/lib/templateDefs';
import { PARTS } from '@/lib/parts';
import { KITS } from '@/lib/kits';

// Public routes only: /admin and /api are left out on purpose.
const ROUTES = ['', '/quote', '/request', '/shop', '/playground', '/track', '/materials', '/how-it-works', '/about', '/credits', '/contact', ...shopVisible(CATALOG).map((i) => `/blueprint/${i.id}`), ...[...shopVisible(CATALOG), ...shopVisible(TEMPLATES), ...shopVisible(KITS)].map((i) => `/shop/${i.id}`), ...PARTS.map((p) => `/shop/part/${p.id}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL?.trim() || 'https://printpro3d.vercel.app').replace(/\/+$/, '');
  return ROUTES.map((r) => ({ url: `${base}${r}` }));
}
