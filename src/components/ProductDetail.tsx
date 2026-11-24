'use client';

import { productById } from '@/lib/shopProducts';
import { templateById } from '@/lib/templateDefs';
import ItemDetail from './ShopItem';
import { TemplateDetail } from './TemplateShop';
import Recommendations from './Recommendations';

export default function ProductDetail({ id }: { id: string }) {
  const p = productById(id);
  const t = templateById(id);
  if (!p && !t) return null;
  return (
    <div className="space-y-6">
      {p ? <ItemDetail p={p} /> : t ? <TemplateDetail t={t} /> : null}
      <Recommendations id={id} />
    </div>
  );
}
