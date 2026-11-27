// "Printing materials" we sell, offered by ENQUIRY only: no prices, no stock, no brands, no spool weights.
// Only generic facts; colours, sizes, thicknesses and brands are "ask" until the owner gives real data (context/GAPS.md).
// Not the plastics we PRINT in (see MATERIALS in quote.ts and /materials). Pure data, safe for the browser.
export type SupplyGroup = 'filament' | 'resin' | 'sheet';
export type Supply = {
  id: string; group: SupplyGroup; title: string; blurb: string;
  specs: [label: string, value: string][];
  price?: undefined; sku?: undefined; // never set: enquiry-only
};

export const SUPPLY_GROUPS: { id: SupplyGroup; label: string }[] = [
  { id: 'filament', label: 'Filament' },
  { id: 'resin', label: 'Resin' },
  { id: 'sheet', label: 'Laser sheets' },
];

const ASK = 'Ask';
const fil = (id: string, name: string, blurb: string): Supply => ({
  id, group: 'filament', title: `${name} filament`, blurb,
  specs: [['Diameter', '1.75 mm is common; ask'], ['Colours', ASK], ['Spool size', ASK], ['Brand', ASK]],
});
const sheet = (id: string, name: string, blurb: string): Supply => ({
  id, group: 'sheet', title: `${name} sheet`, blurb,
  specs: [['Thickness', ASK], ['Sheet size', ASK], ['Colours', ASK], ['Cut to size', ASK]],
});

export const SUPPLIES: Supply[] = [
  fil('filament-pla', 'PLA', 'Easy to print, rigid, for display parts and prototypes.'),
  fil('filament-petg', 'PETG', 'Tougher and more heat tolerant than PLA, for functional parts.'),
  fil('filament-abs', 'ABS', 'Heat tolerant and sandable; needs an enclosed printer.'),
  fil('filament-tpu', 'TPU', 'Flexible rubber-like filament for gaskets, grips and bumpers.'),
  {
    id: 'resin-standard', group: 'resin', title: 'Standard resin', blurb: 'Photopolymer resin for LCD, DLP and SLA resin printers. Wear gloves; parts need washing and curing.',
    specs: [['Printer type', 'Resin (not filament)'], ['Colours', ASK], ['Bottle size', ASK], ['Brand', ASK]],
  },
  sheet('sheet-acrylic', 'Acrylic', 'Clear and coloured plastic sheet for laser cutting and engraving.'),
  sheet('sheet-mdf', 'MDF', 'Smooth wood-fibre board for laser cutting and engraving.'),
  sheet('sheet-plywood', 'Plywood', 'Layered wood sheet for laser cutting and engraving.'),
];

export const supplyById = (id: unknown): Supply | null => (typeof id === 'string' ? SUPPLIES.find((s) => s.id === id) ?? null : null);
