// Plain-language notes for each material in quote.ts. Typed by MaterialKey, so a new material
// does not compile until it has a label and a blurb here.
import type { MaterialKey } from './quote.ts';

export const MATERIAL_INFO: Record<MaterialKey, { label: string; blurb: string }> = {
  PLA: { label: 'PLA', blurb: 'Rigid and easy to print. Good for display parts, prototypes and toys.' },
  PETG: { label: 'PETG', blurb: 'Tougher and slightly flexible. Good for enclosures and brackets.' },
  ABS: { label: 'ABS', blurb: 'Heat resistant and strong. Good for drone frames and functional parts.' },
  TPU: { label: 'TPU', blurb: 'Flexible and rubbery. Good for grips, bumpers and gaskets.' },
};
