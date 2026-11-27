import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import IdeaRequest from '@/components/IdeaRequest';
import { madeById } from '@/lib/madeToOrder';

export const metadata: Metadata = { title: 'Laser cutting and engraving - PrintPro3D', description: '3D printing, laser cutting and materials. We cut and engrave acrylic, MDF and plywood sheets; send a 2D file or describe it for a quote.' };

export default async function LaserPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const found = madeById((await searchParams).item);
  const made = found?.via !== 'print' ? found : null; // unknown or print-only id: the plain laser form
  return (
    <PageShell title="Laser cutting and engraving" lead="We cut and engrave sheets: acrylic, MDF and plywood. Other materials on request.">
      <ul className="list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
        <li>Send a 2D file (SVG, ASCII DXF or PDF, up to 4MB), or just describe what you want.</li>
        <li>Tell us the material, thickness, size, whether to cut or engrave, and how many.</li>
        <li>Price is quote on request. We review the request and reply before anything is made.</li>
      </ul>
      <IdeaRequest mode="laser" part={made ? { id: made.id, title: made.title, lipo: false } : undefined} />
    </PageShell>
  );
}
