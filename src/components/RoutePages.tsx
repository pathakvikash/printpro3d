'use client';

// Client wrappers: they hold the router callbacks and the ssr:false dynamic imports that server pages cannot.
// No static imports of heavy components here: every route that imports this file ships them (ShopRoute lives in its own file for that reason).
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const loading = () => <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
const AiGenerate = dynamic(() => import('./AiGenerate'), { ssr: false, loading });
const AiDesign = dynamic(() => import('./AiDesign'), { ssr: false, loading });
const AiChat = dynamic(() => import('./AiChat').then((m) => m.AiChat), { ssr: false, loading });
// the whole blueprint-first flow (and three's editor code with it) stays out of every other route
const BuildFlow = dynamic(() => import('./build/BuildFlow'), {
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
export function AiChatRoute() {
  return <AiChat />;
}
export function BuildRoute() {
  return <BuildFlow />;
}
