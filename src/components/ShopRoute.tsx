'use client';

import { useRouter } from 'next/navigation';
import ShopOrder from './ShopOrder';

export default function ShopRoute() {
  const router = useRouter();
  return <ShopOrder onWholesale={() => router.push('/request')} />;
}
