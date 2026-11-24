// One action pattern per shop card type: a primary button and a secondary link, same row, same size, icon + label.
//   item (fixed)  : Add              + Customise (builder example, else the product page)
//   template      : Add              + Customise (/shop/<id> configurator; adds the DEFAULT config)
//   kit           : Add              + Build (/shop/<id>)
//   part (bought) : Enquire (link)   + Details (/shop/part/<id>); price shown as "Price on request"
// Pure so a test can pin it; the cards in ShopOrder, TemplateShop, KitShop and MotorShelf render from it.
export type CardKind = 'item' | 'template' | 'kit' | 'part';
export type CardAction = { label: string; hint: string; href?: string; icon: 'cart' | 'wrench' };

export function cardActions(kind: CardKind, id: string, exampleId?: string | null): { primary: CardAction; secondary: CardAction & { href: string } } {
  const page = `/shop/${id}`;
  switch (kind) {
    case 'item': return { primary: { label: 'Add', hint: 'Add to cart', icon: 'cart' }, secondary: { label: 'Customise', hint: 'Customise this product', icon: 'wrench', href: exampleId ? `/playground?mode=build&example=${exampleId}` : page } };
    case 'template': return { primary: { label: 'Add', hint: 'Add to cart', icon: 'cart' }, secondary: { label: 'Customise', hint: 'Customise this product', icon: 'wrench', href: page } };
    case 'kit': return { primary: { label: 'Add', hint: 'Add whole kit to cart', icon: 'cart' }, secondary: { label: 'Build', hint: 'See the build', icon: 'wrench', href: page } };
    case 'part': return { primary: { label: 'Enquire', hint: 'Enquire about this part', icon: 'cart', href: `/request?part=${encodeURIComponent(id)}` }, secondary: { label: 'Details', hint: 'Part details', icon: 'wrench', href: `/shop/part/${id}` } };
  }
}

/** "Customise with AI" for a fixed item: the builder opens a sandbox copy of the example (the catalog is never touched) with the AI panel open. */
export const aiHref = (exampleId: string) => `/playground?mode=build&example=${encodeURIComponent(exampleId)}&ai=1`;
