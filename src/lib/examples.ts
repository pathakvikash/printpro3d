// Example designs made with our own playground (primitives and holes only), so there is no licence question.
// All sit on the plate (lowest point Z=0), centred on the origin, sizes in mm.
// COMMUNITY MODELS: when STL files are added under public/models/showcase/ with manifest.json, render them here with credit
import type { CATEGORIES } from './catalog.ts';
import type { Kind, Shape } from './playground.ts';

export type Example = {
  id: string;
  title: string;
  category: (typeof CATEGORIES)[number]['id'];
  blurb: string;
  shapes: Shape[];
};

let n = 0;
const mk = (id: string) => (kind: Kind, size: [number, number, number], pos: [number, number, number], mode: Shape['mode'] = 'solid', rot: [number, number, number] = [0, 0, 0]): Shape => ({
  id: `${id}${n++}`, kind, mode,
  size: { x: size[0], y: size[1], z: size[2] },
  position: { x: pos[0], y: pos[1], z: pos[2] },
  rotation: { x: rot[0], y: rot[1], z: rot[2] },
});

const bracket = mk('br');
const pi = mk('pi');
const stand = mk('st');
const clip = mk('cl');
const spin = mk('sp');
const pawn = mk('pw');
const drone = mk('dr');

export const EXAMPLES: Example[] = [
  {
    id: 'shelf-bracket', title: 'Shelf bracket', category: 'gadget',
    blurb: 'An L-shaped bracket with two screw holes in each leg.',
    shapes: [
      bracket('box', [40, 30, 5], [0, 0, 2.5]),
      bracket('box', [40, 5, 40], [0, -12.5, 20]),
      bracket('cylinder', [5, 5, 20], [-12, 5, 2.5], 'hole'),
      bracket('cylinder', [5, 5, 20], [12, 5, 2.5], 'hole'),
      bracket('cylinder', [5, 5, 20], [-12, -12.5, 28], 'hole', [90, 0, 0]),
      bracket('cylinder', [5, 5, 20], [12, -12.5, 28], 'hole', [90, 0, 0]),
    ],
  },
  {
    id: 'pi-case', title: 'Small computer case base', category: 'enclosure',
    blurb: 'An open box with four screw posts sized for a Raspberry Pi board, and a cable cut-out.',
    shapes: [
      pi('box', [90, 62, 12], [0, 0, 6]),
      pi('box', [86, 58, 12], [0, 0, 9], 'hole'),
      pi('cylinder', [6, 6, 7], [-29, -24.5, 3.5]),
      pi('cylinder', [6, 6, 7], [29, -24.5, 3.5]),
      pi('cylinder', [6, 6, 7], [-29, 24.5, 3.5]),
      pi('cylinder', [6, 6, 7], [29, 24.5, 3.5]),
      pi('cylinder', [2.5, 2.5, 20], [-29, -24.5, 3.5], 'hole'),
      pi('cylinder', [2.5, 2.5, 20], [29, -24.5, 3.5], 'hole'),
      pi('cylinder', [2.5, 2.5, 20], [-29, 24.5, 3.5], 'hole'),
      pi('cylinder', [2.5, 2.5, 20], [29, 24.5, 3.5], 'hole'),
      pi('box', [14, 6, 6], [0, -30, 8], 'hole'),
    ],
  },
  {
    id: 'phone-stand', title: 'Phone stand', category: 'gadget',
    blurb: 'A sloped back and a front lip hold a phone upright, with a notch for the charging cable.',
    shapes: [
      stand('box', [70, 60, 5], [0, 0, 2.5]),
      stand('wedge', [40, 70, 60], [0, -10, 30], 'solid', [0, 0, 90]),
      stand('box', [70, 5, 12], [0, 27.5, 6]),
      stand('cylinder', [14, 14, 30], [0, 15, 2.5], 'hole'),
    ],
  },
  {
    id: 'cable-clip', title: 'Cable clip', category: 'gadget',
    blurb: 'A small open ring on a flat pad that holds a cable against a desk.',
    shapes: [
      clip('cylinder', [16, 16, 12], [0, 0, 6]),
      clip('box', [24, 22, 3], [0, 0, 1.5]),
      clip('cylinder', [8, 8, 20], [0, 0, 6], 'hole'),
      clip('box', [4, 12, 20], [0, -7, 6], 'hole'),
    ],
  },
  {
    id: 'spinner-toy', title: 'Spinner toy head', category: 'toy',
    blurb: 'A three-bar spinner with a 3 mm hole in the middle for a motor shaft.',
    shapes: [
      spin('cylinder', [20, 20, 8], [0, 0, 4]),
      spin('box', [60, 8, 5], [0, 0, 2.5]),
      spin('box', [56, 8, 5], [0, 0, 2.5], 'solid', [0, 0, 60]),
      spin('box', [52, 8, 5], [0, 0, 2.5], 'solid', [0, 0, 120]),
      spin('cylinder', [3, 3, 20], [0, 0, 4], 'hole'),
    ],
  },
  {
    id: 'pawn', title: 'Chess-style pawn', category: 'game',
    blurb: 'A pawn made of a round base, a tapered body, a collar and a ball head.',
    shapes: [
      pawn('cylinder', [28, 28, 5], [0, 0, 2.5]),
      pawn('cone', [20, 20, 22], [0, 0, 16]),
      pawn('cylinder', [18, 18, 3], [0, 0, 26.5]),
      pawn('sphere', [16, 16, 16], [0, 0, 33]),
    ],
  },
  {
    id: 'drone-plate', title: 'Drone frame plate', category: 'drone',
    blurb: 'An X-shaped frame plate with four motor mounts and shaft holes.',
    shapes: [
      drone('box', [40, 40, 3], [0, 0, 1.5]),
      drone('box', [80, 12, 3], [0, 0, 1.5], 'solid', [0, 0, 45]),
      drone('box', [80, 12, 3], [0, 0, 1.5], 'solid', [0, 0, -45]),
      drone('cylinder', [22, 22, 3], [-28, -28, 1.5]),
      drone('cylinder', [22, 22, 3], [28, -28, 1.5]),
      drone('cylinder', [22, 22, 3], [-28, 28, 1.5]),
      drone('cylinder', [22, 22, 3], [28, 28, 1.5]),
      drone('cylinder', [8, 8, 10], [-28, -28, 1.5], 'hole'),
      drone('cylinder', [8, 8, 10], [28, -28, 1.5], 'hole'),
      drone('cylinder', [8, 8, 10], [-28, 28, 1.5], 'hole'),
      drone('cylinder', [8, 8, 10], [28, 28, 1.5], 'hole'),
    ],
  },
];

export const exampleById = (id: string | null | undefined) => EXAMPLES.find((e) => e.id === id) ?? null;
