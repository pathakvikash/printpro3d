'use client';

// Floating "AI" button on every page (not on /ai or /admin) plus the open-chat event the header button fires.
// The chat itself (and three.js for its preview) loads only when opened.
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';

export const OPEN_AI_CHAT = 'pp:open-ai-chat';
const AiChatDialog = dynamic(() => import('./AiChat'), { ssr: false });

export default function AiChatLauncher() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null); // the path it was opened on: navigating closes it
  const open = openOn === pathname;
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null);
  const onChatPage = pathname === '/ai' || pathname.startsWith('/admin');

  useEffect(() => {
    const o = () => setOpenOn(window.location.pathname);
    window.addEventListener(OPEN_AI_CHAT, o);
    return () => window.removeEventListener(OPEN_AI_CHAT, o);
  }, []);

  return (
    <>
      {!onChatPage && !open && (
        // bottom-right, above the phone sticky bars (bottom-20), mirror of the WhatsApp button on the left
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Build with AI"
          title="Build with AI"
          className="fixed bottom-20 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:bottom-4 dark:ring-white/20"
        >
          <Icon name="spark" className="h-5 w-5" />AI
        </button>
      )}
      {open && <AiChatDialog onClose={() => setOpen(false)} />}
    </>
  );
}
