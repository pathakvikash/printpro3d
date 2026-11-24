// One action pattern per shop card type: a primary button and a secondary link, same row, same size, icon + label.
//   item (fixed)  : Add to cart      + Customise (builder example, else the product page)
//   template      : Add to cart      + Customise (/shop/<id> configurator; adds the DEFAULT config)
//   kit           : Add whole kit    + See the build (/shop/<id>)
//   part (bought) : Enquire (link)   + Details (/shop/part/<id>); price shown as "Price on request"
// Pure so a test can pin it; the cards in ShopOrder, TemplateShop, KitShop and MotorShelf render from it.
export type CardKind = 'item' | 'template' | 'kit' | 'part';
export type CardAction = { label: string; href?: string; icon: 'cart' | 'wrench' };

export function cardActions(kind: CardKind, id: string, exampleId?: string | null): { primary: CardAction; secondary: CardAction & { href: string } } {
  const page = `/shop/${id}`;
  switch (kind) {
    case 'item': return { primary: { label: 'Add to cart', icon: 'cart' }, secondary: { label: 'Customise', icon: 'wrench', href: exampleId ? `/playground?mode=build&example=${exampleId}` : page } };
    case 'template': return { primary: { label: 'Add to cart', icon: 'cart' }, secondary: { label: 'Customise', icon: 'wrench', href: page } };
    case 'kit': return { primary: { label: 'Add whole kit', icon: 'cart' }, secondary: { label: 'See the build', icon: 'wrench', href: page } };
    case 'part': return { primary: { label: 'Enquire', icon: 'cart', href: `/request?part=${encodeURIComponent(id)}` }, secondary: { label: 'Details', icon: 'wrench', href: `/shop/part/${id}` } };
  }
}
