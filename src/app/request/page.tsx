import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import IdeaRequest from '@/components/IdeaRequest';
import { partById } from '@/lib/parts';
import { supplyById } from '@/lib/supplies';
import { madeById, madeCategory } from '@/lib/madeToOrder';

export const metadata: Metadata = { title: 'Request 3D printing, laser cutting or materials - PrintPro3D', description: '3D printing, laser cutting and materials. No 3D file? Describe what you want and we will review it and reply with the next steps.' };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ type?: string; part?: string; material?: string; item?: string }> }) {
  const sp = await searchParams;
  const replacement = sp.type === 'replacement';
  const supply = supplyById(sp.material); // an enquiry about a printing material: same form, category fixed
  if (supply) return (
    <PageShell title={`Enquire about ${supply.title}`} lead="Tell us what you need and how much. We reply with availability and the next steps.">
      <IdeaRequest mode="material" part={{ id: supply.id, title: supply.title, lipo: false }} />
    </PageShell>
  );
  const made = madeById(sp.item); // a made-to-order item: category preselected, description prefilled
  if (made) return (
    <PageShell title={`Enquire about ${made.title}`} lead="Tell us what you want and how many. We reply with options, price and the next steps.">
      <IdeaRequest part={{ id: made.id, title: made.title, lipo: false }} defaultCategory={madeCategory(made)} />
    </PageShell>
  );
  const part = partById(sp.part); // an enquiry about an electronics part: the description starts with its name
  if (part) return (
    <PageShell title={`Enquire about ${part.title}`} lead="Tell us how many you need and what it is for. We reply with availability and the next steps.">
      <IdeaRequest part={{ id: part.id, title: part.title, lipo: part.category === 'battery' }} />
    </PageShell>
  );
  return replacement ? (
    <PageShell title="Request a replacement part" lead="Share photos and details of the original. We'll review whether it can be reproduced.">
      <IdeaRequest replacement />
    </PageShell>
  ) : (
    <PageShell title="Describe your idea" lead="No file yet? Tell us what you want to make. We'll review it and get back to you with the next steps.">
      <IdeaRequest />
    </PageShell>
  );
}
