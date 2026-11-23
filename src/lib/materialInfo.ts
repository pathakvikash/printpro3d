// Plain-language notes for each material in quote.ts. Typed by MaterialKey, so a new material
// does not compile until it has every field here. Comparison words are relative, not measurements.
import type { MaterialKey } from './quote.ts';

export type MaterialNote = { label: string; blurb: string; strength: string; flexibility: string; heat: string; use: string };

export const MATERIAL_INFO: Record<MaterialKey, MaterialNote> = {
  PLA: { label: 'PLA', blurb: 'Rigid and easy to print. Good for display parts, prototypes and toys.', strength: 'Rigid', flexibility: 'Low', heat: 'Lowest of the four', use: 'Display parts, prototypes, toys' },
  PETG: { label: 'PETG', blurb: 'Tougher and slightly flexible. Good for enclosures and brackets.', strength: 'Tough', flexibility: 'Slight', heat: 'Varies', use: 'Enclosures, brackets' },
  ABS: { label: 'ABS', blurb: 'Heat resistant and strong. Good for drone frames and functional parts.', strength: 'Strong', flexibility: 'Low', heat: 'Highest of the four', use: 'Drone frames, functional parts' },
  TPU: { label: 'TPU', blurb: 'Flexible and rubbery. Good for grips, bumpers and gaskets.', strength: 'Soft and elastic', flexibility: 'High', heat: 'Varies', use: 'Grips, bumpers, gaskets' },
};
