'use client';

import { productById } from '@/lib/shopProducts';
import { templateById } from '@/lib/templateDefs';
import ItemDetail from './ShopItem';
import { TemplateDetail } from './TemplateShop';

export default function ProductDetail({ id }: { id: string }) {
  const p = productById(id);
  const t = templateById(id);
  return p ? <ItemDetail p={p} /> : t ? <TemplateDetail t={t} /> : null;
}
