'use client';

import { useRouter } from 'next/navigation';
import CompleteBuilds from './CompleteBuilds';
import MotorShelf from './MotorShelf';
import ShopCatalogs from './ShopCatalogs';
import ShopOrder from './ShopOrder';

export default function ShopRoute() {
  const router = useRouter();
  return (
    <>
      <div className="mb-8"><CompleteBuilds anchor="kits" /></div>
      <ShopOrder onWholesale={() => router.push('/request')} />
      <MotorShelf />
      <ShopCatalogs />
    </>
  );
}
