// Plain-language definitions for jargon used in the app. Worded from what quote.ts, blueprint.ts, printSpec.ts,
// materialInfo.ts and motors.ts actually do. Layer height is an assumption, so it says so.
export const GLOSSARY = {
  'fill-factor': 'The share of a part\'s volume we count as solid plastic when pricing weight: 0.4, about 20% infill plus the outer walls.',
  'third-angle': 'The standard way to lay out a drawing: front, top and side views arranged so each view sits next to the face it shows.',
  triangles: 'The flat facets that make up a 3D model\'s surface. More triangles means finer detail and a bigger file.',
  openings: 'Holes that pass all the way through the part. We count how many, but not their size or position.',
  fc: 'Flight controller: the small circuit board that reads the sensors and tells the motors how fast to spin.',
  esc: 'Electronic speed controller: the board between the battery and a motor that sets how fast the motor turns.',
  aio: 'All-in-one board: a flight controller and speed controllers combined on a single board.',
  manifold: 'A closed mesh with no gaps: every edge joins exactly two triangles. We need this to measure volume reliably.',
  'layer-height': 'The thickness of each printed layer. We assume 0.2 mm; this has not been confirmed.',
  infill: 'The pattern printed inside a part instead of solid plastic. Less infill is lighter and cheaper, more is stronger.',
  tpu: 'Flexible and rubbery. Good for grips, bumpers and gaskets.',
  petg: 'Tougher and slightly flexible. Good for enclosures and brackets.',
  pla: 'Rigid and easy to print. Good for display parts, prototypes and toys.',
  abs: 'Heat resistant and strong. Good for drone frames and functional parts.',
  'bounding-box': 'The smallest box that fits around the whole model. Its sides are the part\'s length, width and height.',
} as const;

export type TermKey = keyof typeof GLOSSARY;
