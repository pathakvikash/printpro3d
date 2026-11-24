'use client';
// The /shop grid cards for kits and templates, light: only metadata, so /shop's first load has no three or CSG in it.
// Once the page shows, the full card (meshes, prices, 3D thumb, add to cart) loads from KitShop / TemplateShop and replaces this one.

import { useEffect, useState } from 'react';
import { shopCat, shopCatLabel } from '@/lib/catalog';
import { kitMetaPartCount, type KitMeta } from '@/lib/kitMeta';
import { COMING_SOON, type TemplateDef } from '@/lib/templateDefs';
import { CardActions, CardFrame } from './ShopParts';

const loadKit = () => import('./KitShop');
const loadTemplate = () => import('./TemplateShop');
function useLoaded<T>(load: () => Promise<T>) {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    void load().then((m) => on && setMod(m));
    return () => { on = false; };
  }, [load]);
  return mod;
}
const noop = () => {};

export function KitCardLight({ kit }: { kit: KitMeta }) {
  const mod = useLoaded(loadKit);
  if (mod) return <mod.KitCardById id={kit.id} />;
  const rows: [string, string][] = kit.products
    ? [['Products', `${kit.products.length}: ${kit.products.join(', ')}`], ['Printed parts', `${kitMetaPartCount(kit)} in ${kit.parts.length} kinds (first product)`]]
    : [['Printed parts', `${kitMetaPartCount(kit)} in ${kit.parts.length} kinds`], ['Bought separately', `${kit.bought} items`]];
  if (kit.design) rows.push(['Design', `by ${kit.design.author}, ${kit.design.licence}`]);
  return (
    <CardFrame
      href={`/shop/${kit.id}`}
      category={`${shopCatLabel(shopCat(kit.id) ?? '')} · Kit${kit.badge ? ` · ${kit.badge}` : ''}`}
      name={kit.title}
      blurb={kit.blurb}
      rows={rows}
      preview={kit.hasAssembly ? null : <div className="flex h-full flex-col justify-center gap-0.5 p-4 text-sm text-gray-700 dark:text-gray-300">{kit.parts.map((p) => <span key={p.name}>{p.qty > 1 ? `${p.qty} x ` : ''}{p.name}</span>)}</div>}
      actions={<CardActions kind="kit" id={kit.id} added={false} disabled onPrimary={noop} />}
    />
  );
}

export function TemplateCardLight({ t, live, reduceMotion, setVisible }: { t: TemplateDef; live: boolean; reduceMotion: boolean; setVisible: (id: string, v: boolean) => void }) {
  const mod = useLoaded(loadTemplate);
  if (mod) return <mod.TemplateCard t={t} live={live} reduceMotion={reduceMotion} setVisible={setVisible} />;
  return (
    <CardFrame
      href={`/shop/${t.id}`}
      category={`${shopCatLabel(shopCat(t.id) ?? t.id)} · Configurable`}
      name={t.name}
      blurb={t.blurb}
      rows={[['Size', '…'], ['Material', t.material], ['Weight', '…'], ['From', '…']]}
      preview={null}
      actions={<CardActions kind="template" id={t.id} added={false} disabled onPrimary={noop} />}
    />
  );
}

export function ComingSoon() {
  if (!COMING_SOON.length) return null;
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Coming soon: {COMING_SOON.map((c) => c.name).join(', ')}.
    </p>
  );
}
