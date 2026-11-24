import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import IdeaRequest from '@/components/IdeaRequest';
import { partById } from '@/lib/parts';

export const metadata: Metadata = { title: 'Describe your idea - PrintPro3D', description: 'No 3D file? Describe what you want to make and we will review it and reply with the next steps.' };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ type?: string; part?: string }> }) {
  const sp = await searchParams;
  const replacement = sp.type === 'replacement';
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
