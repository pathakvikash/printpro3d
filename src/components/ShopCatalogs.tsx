'use client';
// The two enquiry-only shelves at the end of /shop: made to order (original designs), then printing materials.
import CatalogShelf from './CatalogShelf';
import { MADE_GROUPS, MADE_ITEMS, VIA_LABEL, madeHref } from '@/lib/madeToOrder';
import { SUPPLIES, SUPPLY_GROUPS } from '@/lib/supplies';
import { supplyHref } from '@/lib/cardActions';

export default function ShopCatalogs() {
  return (
    <>
      <CatalogShelf id="made-to-order" title="Made to order" lead="Original designs we make on request, 3D printed or laser cut. No licensed characters or team logos. Enquire for price and options." groups={MADE_GROUPS} items={MADE_ITEMS.map((x) => ({ id: x.id, group: x.group, alsoIn: x.alsoIn, title: x.title, blurb: x.blurb, tag: VIA_LABEL[x.via], href: madeHref(x) }))} />
      <CatalogShelf id="supplies" title="Materials" lead="Printing materials we sell: filament, resin and sheets for laser cutting. Enquire for colours, sizes, price and availability." groups={SUPPLY_GROUPS} items={SUPPLIES.map((s) => ({ id: s.id, group: s.group, title: s.title, blurb: s.blurb, rows: s.specs, href: supplyHref(s.id) }))} />
    </>
  );
}
