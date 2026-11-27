// "Made to order" catalogue: original designs we make on request, offered by ENQUIRY only. No prices, no photos, no sizes.
// No licensed characters, team or league logos, or resold STL files. `needs` is for the owner (context/GAPS.md), never shown to customers.
// Pure data, safe for the browser.
export type MadeGroup = 'lamps' | 'decor' | 'personalised' | 'desk' | 'gifts' | 'toys' | 'custom';
export type Via = 'print' | 'laser' | 'either';
export type Need = 'price' | 'photo' | 'design file';
export type MadeItem = {
  id: string; group: MadeGroup; alsoIn?: MadeGroup[]; // alsoIn: shown under these groups too (one id, no duplicate)
  title: string; blurb: string; via: Via; needs: Need[];
  price?: undefined; sku?: undefined; // never set: enquiry-only
};

export const MADE_GROUPS: { id: MadeGroup; label: string }[] = [
  { id: 'lamps', label: 'Lamps' },
  { id: 'decor', label: 'Home decoration' },
  { id: 'personalised', label: 'Personalised' },
  { id: 'desk', label: 'Desk & organisers' },
  { id: 'gifts', label: 'Gifts & festive' },
  { id: 'toys', label: 'Toys' },
  { id: 'custom', label: 'Custom models' },
];
export const VIA_LABEL: Record<Via, string> = { print: '3D printed', laser: 'Laser cut', either: '3D printed or laser cut' };

const m = (id: string, group: MadeGroup, via: Via, title: string, blurb: string, alsoIn?: MadeGroup[]): MadeItem =>
  ({ id, group, ...(alsoIn ? { alsoIn } : {}), title, blurb, via, needs: ['price', 'photo', 'design file'] });

export const MADE_ITEMS: MadeItem[] = [
  m('wave-lamp', 'lamps', 'print', 'Wave and fractal-pattern lamp shades', 'Sculptural lamp shades in our own original designs.'),
  m('night-light', 'lamps', 'print', 'LED night lights', 'Printed night lights for a bedroom or hallway.'),
  m('lithophane-lamp', 'lamps', 'print', 'Lithophane photo lamps', 'A lamp that shows your own photo when lit.'),
  m('led-shelf-piece', 'lamps', 'print', 'Decorative LED shelf pieces', 'Small printed pieces with LED lighting for shelves.'),
  m('diwali-lamp', 'lamps', 'either', 'Festive Diwali lamps', 'Lamps for Diwali, printed or laser cut.'),
  m('planter', 'decor', 'print', 'Planters and vases', 'Printed planters and vases in plain geometric shapes.'),
  m('wall-art', 'decor', 'either', 'Wall art, including Om and Ganesh', 'Wall art, printed or laser cut.'),
  m('shelf-decor', 'decor', 'print', 'Shelf decor', 'Printed decorative pieces for shelves.'),
  m('puja-decor', 'decor', 'either', 'Puja and Diwali decor', 'Diya stands, torans and similar festive pieces.'),
  m('nameplate', 'decor', 'laser', 'House nameplates', 'Cut or engraved with your name, in English or Hindi (Devanagari).', ['personalised']),
  m('name-sign', 'personalised', 'laser', 'Name signs', 'Cut or engraved name signs, in English or Hindi (Devanagari).'),
  m('name-keychain', 'personalised', 'either', 'Custom name keychains', 'A keychain with the name you choose.'),
  m('photo-figure-keychain', 'personalised', 'print', 'Photo mini-figure keychains', 'A small figure keychain made from your photo.'),
  m('engraved-coaster', 'personalised', 'laser', 'Engraved coasters', 'Coasters engraved with a name, date or simple design.'),
  m('pet-tag', 'personalised', 'either', 'Pet name tags', 'A tag with your pet\'s name and your number.'),
  m('phone-stand', 'desk', 'print', 'Phone stands', 'A desk stand that holds a phone upright.'),
  m('desk-accessories', 'desk', 'print', 'Cable organisers and desk or gaming accessories', 'Cable holders and small desk or gaming-setup accessories.'),
  m('desk-organiser', 'desk', 'either', 'Pen holders and desk organisers', 'Holders and organisers for pens and small desk items.'),
  m('mdf-storage', 'desk', 'laser', 'Wall storage and drawer organisers in MDF', 'Laser-cut MDF storage and drawer dividers.'),
  m('rangoli-stencil', 'gifts', 'laser', 'Rangoli stencils', 'Laser-cut stencils for rangoli patterns.'),
  m('rakhi-gift', 'gifts', 'either', 'Raksha Bandhan gifts', 'Personalised gifts for Raksha Bandhan.'),
  m('cricket-desk', 'gifts', 'print', 'Cricket desk items', 'Cricket-themed desk items, without team logos.'),
  m('gift-box', 'gifts', 'laser', 'Engraved gift boxes', 'Boxes engraved with a name or message.'),
  m('laser-earrings', 'gifts', 'laser', 'Laser-cut earrings', 'Lightweight earrings cut from sheet.'),
  m('flexi-toy', 'toys', 'print', 'Articulated (flexi) toys', 'Printed toys with moving joints.'),
  m('flexi-snake', 'toys', 'print', 'Articulated snake fidget', 'A printed snake that bends and twists.'),
  m('scale-model', 'custom', 'print', 'Home and building scale models', 'A scale model made from your plans or photos.'),
  m('school-model', 'custom', 'print', 'School project models', 'Models for school projects, made to your brief.'),
];

export const madeById = (id: unknown): MadeItem | null => (typeof id === 'string' ? MADE_ITEMS.find((x) => x.id === id) ?? null : null);

/** Where Enquire goes: laser items to the laser form, the rest to the general one. */
export const madeHref = (x: MadeItem) => `/${x.via === 'laser' ? 'laser' : 'request'}?item=${encodeURIComponent(x.id)}`;

/** The request category (an id in CATEGORIES) a print or either item starts with. Laser items use 'laser'. */
export const madeCategory = (x: MadeItem): string =>
  x.via === 'laser' ? 'laser' : x.group === 'toys' ? 'toy' : x.group === 'personalised' || x.group === 'desk' || x.group === 'lamps' ? 'gadget' : 'other';
