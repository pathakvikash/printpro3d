import type { MetadataRoute } from 'next';

// Public routes only: /admin and /api are left out on purpose.
const ROUTES = ['', '/quote', '/request', '/shop', '/build', '/track', '/materials', '/how-it-works', '/about', '/contact'];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL?.trim() || 'https://printpro3d.vercel.app').replace(/\/+$/, '');
  return ROUTES.map((r) => ({ url: `${base}${r}` }));
}
