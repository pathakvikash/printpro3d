'use client';

// Client wrappers: they hold the router callbacks and the ssr:false dynamic imports that server pages cannot.
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ShopOrder from './ShopOrder';

const loading = () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
const AiGenerate = dynamic(() => import('./AiGenerate'), { ssr: false, loading });
const AiDesign = dynamic(() => import('./AiDesign'), { ssr: false, loading });
// three's editor code stays out of every other route
const Playground = dynamic(() => import('./Playground'), {
  ssr: false,
  loading: () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading the builder…</p>,
});

export function AiGenerateRoute() {
  const router = useRouter();
  return <AiGenerate onDesigner={() => router.push('/request')} />;
}
export function AiDesignRoute() {
  const router = useRouter();
  return <AiDesign onDesigner={() => router.push('/request')} />;
}
export function ShopRoute() {
  const router = useRouter();
  return <ShopOrder onWholesale={() => router.push('/request')} />;
}
export function BuildRoute() {
  return <Playground />;
}
