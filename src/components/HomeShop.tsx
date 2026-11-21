'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// the shop code (and its 3D previews) loads only when the grid nears the viewport
const ShopOrder = dynamic(() => import('./ShopOrder'), { ssr: false, loading: () => <ShopSkeleton /> });

// three placeholder cards at about the height of a real card, so the page does not jump when the shop mounts
function ShopSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="h-[30rem] rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        ))}
      </ul>
    </div>
  );
}

export default function HomeShop() {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // mount the shop once its area is within 400px of the viewport; after that it stays mounted
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <div ref={box}>
      {near ? <ShopOrder embedded limit={3} onWholesale={() => router.push('/request')} /> : <ShopSkeleton />}
    </div>
  );
}
