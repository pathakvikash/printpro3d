import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import IdeaRequest from '@/components/IdeaRequest';

export const metadata: Metadata = { title: 'Describe your idea - PrintPro3D', description: 'No 3D file? Describe what you want to make and we will review it and reply with the next steps.' };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const replacement = (await searchParams).type === 'replacement';
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
