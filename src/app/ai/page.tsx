import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import { AiChatRoute } from '@/components/RoutePages';

export const metadata: Metadata = { title: 'Build with AI - PrintPro3D', description: 'Describe a part or add a photo, refine it in a chat, then edit, price and order it.' };

// The same chat the header and floating "AI" buttons open; it asks /api/designs what is available (shape AI, Meshy).
export default function AiPage() {
  return (
    <PageShell title="Build with AI" lead="Describe a part or add a photo. Refine it in the chat, then edit, price and order it.">
      <div className="h-[min(760px,calc(100vh-14rem))] min-h-[480px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
        <AiChatRoute />
      </div>
    </PageShell>
  );
}
