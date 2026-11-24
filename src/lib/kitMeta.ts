// Light copy of what a /shop kit card shows (no geometry imports, so /shop's first load stays free of three and the CSG).
// kits.test.ts checks it against KITS; when a kit changes, that test prints the new value to paste here.
export type KitMeta = {
  id: string; title: string; blurb: string; category: 'drone-rc' | 'robotics' | 'toys-hobby' | 'smart-home'; badge?: string;
  design?: { author: string; licence: string }; products?: string[]; hasAssembly: boolean; parts: { name: string; qty: number }[]; bought: number;
};
export const KIT_METAS: KitMeta[] = [
  {
    "id": "fpv-3in-kit",
    "title": "FPV 3-inch build kit",
    "blurb": "The printed parts for a small FPV quad built around 3 inch (76.2 mm) props: our true-X frame (160 mm motor to motor, so adjacent motors are 113 mm apart and the props have 37 mm between their tips; 12 x 12 mm M2 motor holes and a 20 x 20 mm stack pattern are typical, check yours), a camera mount, 4 prop guards, landing gear, a battery tray and a GPS puck mount. Motors, electronics and battery are bought separately.",
    "category": "drone-rc",
    "hasAssembly": true,
    "parts": [
      {
        "name": "3 inch FPV quad frame (true X)",
        "qty": 1
      },
      {
        "name": "Drone camera mount (TPU-friendly)",
        "qty": 1
      },
      {
        "name": "Prop guard ring (one motor)",
        "qty": 4
      },
      {
        "name": "Landing gear skids (pair)",
        "qty": 1
      },
      {
        "name": "Battery tray with strap slots",
        "qty": 1
      },
      {
        "name": "GPS puck mount",
        "qty": 1
      }
    ],
    "bought": 7
  },
  {
    "id": "rover-kit",
    "title": "Rover build kit (4WD)",
    "blurb": "The printed parts for a small 4WD rover: a chassis plate, 4 motor mounts, 4 wheels, a servo bracket and a battery tray. Motors, electronics and battery are bought separately.",
    "category": "robotics",
    "hasAssembly": true,
    "parts": [
      {
        "name": "Robot chassis plate (2WD / 4WD)",
        "qty": 1
      },
      {
        "name": "Motor mount",
        "qty": 4
      },
      {
        "name": "Wheel for N20 / TT motors",
        "qty": 4
      },
      {
        "name": "Servo bracket",
        "qty": 1
      },
      {
        "name": "Battery tray with strap slots",
        "qty": 1
      }
    ],
    "bought": 5
  },
  {
    "id": "whoop-kit",
    "title": "65/75 mm whoop kit",
    "blurb": "A 65 mm whoop in three printed parts. The frame is one piece with 4 ducts (33 mm inside for 31 mm props, 14 mm tall); each motor hub has 4 M1.4 bolt holes 6.6 mm apart and a 3.6 mm wire bore, so 16 bolt holes in all. The centre plate has 4 M2 bosses on a 25.5 mm square for the board, 2 battery lead holes and 2 strap screw holes. The canopy has a 14.4 mm camera sleeve tilted 25 degrees, 2 screw pillars, 2 roof vents and a rear antenna tube. The strap tab has 2 screw holes and 2 strap slots. Motors, board, battery, props and camera are bought. Sizes marked typical are common ones: check yours.",
    "category": "drone-rc",
    "hasAssembly": true,
    "parts": [
      {
        "name": "Frame with 4 ducts",
        "qty": 1
      },
      {
        "name": "Canopy with camera sleeve",
        "qty": 1
      },
      {
        "name": "Battery strap tab",
        "qty": 1
      }
    ],
    "bought": 7
  },
  {
    "id": "heli-kit",
    "title": "Mini RC helicopter airframe",
    "blurb": "A printed airframe for a mini RC helicopter: 2 side frames (10 through holes each plus one servo screw hole per servo, 5 mm rounded 5 mm corners), 2 bearing bridges (1 bearing seat each, sized for a typical 2x5x2.5 or 3x8x3 mm bearing), a canopy (4 vent slots, 1 mast opening, 4 friction tabs), a tail boom clamp (4 through holes, split for a 4 mm tube), a tail boom holder (2 through holes, a blind tube bore and a blind pocket for a 7 mm motor), 2 landing skids (2 screw holes each) and 2 or 3 servo mounts (2 through holes each, with a cable channel). The rotor head (single or coaxial), the blades, the motors, servos, boom tube, bearings, electronics and battery are all bought, never printed. Sizes marked typical are common hobby sizes; check yours.",
    "category": "drone-rc",
    "hasAssembly": true,
    "parts": [
      {
        "name": "Side frame (print flat)",
        "qty": 2
      },
      {
        "name": "Bearing bridge (print flat, boss up)",
        "qty": 2
      },
      {
        "name": "Canopy (print dome up on its rim)",
        "qty": 1
      },
      {
        "name": "Tail boom clamp (print as shown)",
        "qty": 1
      },
      {
        "name": "Tail boom holder (print as shown)",
        "qty": 1
      },
      {
        "name": "Landing skid (print on its side)",
        "qty": 2
      },
      {
        "name": "Servo mount (print flat)",
        "qty": 2
      }
    ],
    "bought": 10
  },
  {
    "id": "transformer-kit",
    "title": "Transformer kit: mini car to robot",
    "blurb": "Beta: an original blocky toy that folds from a car into a robot, every part printed, tolerances untested without a physical print. Chassis, 100 x 36 x 24 mm, with 3 hood vent slots cut through, 4 screw bosses under a belly tray that a belly plate closes, a cable channel and 2 cross-pin holes plus a head pivot. 2 leg and 2 arm blocks swing 90 degrees on 3 mm pins and carry 4 wheels, each wheel with 5 spoke windows on a 4 mm axle; the head flips 180 degrees out of its roof seat. Hinge clearance is 0.2 to 0.5 mm and adds to every hole. With magnets on, 8 pockets (4 in the chassis sides, 4 in the limbs) take 6 x 2 mm discs that latch car mode. Pins and axles print separately, not print-in-place. One fold slider runs the whole motion, 0 = car, 1 = robot; stand the robot up by hand.",
    "category": "toys-hobby",
    "badge": "Beta",
    "hasAssembly": true,
    "parts": [
      {
        "name": "Chassis",
        "qty": 1
      },
      {
        "name": "Belly plate",
        "qty": 1
      },
      {
        "name": "Leg block",
        "qty": 2
      },
      {
        "name": "Arm block",
        "qty": 2
      },
      {
        "name": "Head",
        "qty": 1
      },
      {
        "name": "Wheel",
        "qty": 4
      },
      {
        "name": "Wheel axle",
        "qty": 4
      },
      {
        "name": "Cross-pin (leg or arm hinge)",
        "qty": 2
      },
      {
        "name": "Head pivot pin",
        "qty": 1
      }
    ],
    "bought": 2
  },
  {
    "id": "led-decor-kit",
    "title": "LED decor kit: matrix frame, desk clock and moon lamp",
    "blurb": "Three printable digital decor products from one kit. An LED matrix frame for a WS2812 8x8 or 16x16 grid (typical 10 mm pixel pitch on 16x16 panels) with light-grid baffles, a diffuser slot and a back cover with an ESP32 cradle and USB-C cutout. A smart desk clock case for a 4-digit 7-segment module or a 0.96 in OLED, with a stand. A low-poly moon lamp shell with a 1.2 mm wall on a base that holds the LED strip and an ESP32. Module and board sizes are typical values; check yours before printing.",
    "category": "smart-home",
    "products": [
      "LED matrix frame",
      "Smart desk clock",
      "Low-poly moon lamp"
    ],
    "hasAssembly": true,
    "parts": [
      {
        "name": "LED matrix frame",
        "qty": 1
      },
      {
        "name": "Light-grid baffles",
        "qty": 1
      },
      {
        "name": "Back cover with ESP32 cradle",
        "qty": 1
      }
    ],
    "bought": 8
  },
  {
    "id": "rc-car",
    "title": "1/28 RC car (zcar)",
    "blurb": "Open-hardware 1/28 RC chassis with independent front suspension and Ackermann steering. Fits MINI-Z body shells.",
    "category": "drone-rc",
    "design": {
      "author": "alexyu132",
      "licence": "GPL-3.0"
    },
    "hasAssembly": true,
    "parts": [
      {
        "name": "Chassis tray 1 (print at 0.15 mm)",
        "qty": 1
      },
      {
        "name": "Chassis tray 2 (print at 0.1 mm)",
        "qty": 1
      },
      {
        "name": "10T motor pinion",
        "qty": 1
      },
      {
        "name": "43T spur gear",
        "qty": 1
      },
      {
        "name": "Motor mount, 10T:43T, loose fit",
        "qty": 1
      }
    ],
    "bought": 14
  },
  {
    "id": "desk-pet",
    "title": "Sesame desk pet",
    "blurb": "ESP32 desk quadruped on eight MG90S servos, with an OLED face. Open hardware, PLA.",
    "category": "robotics",
    "design": {
      "author": "dorianborian",
      "licence": "Apache-2.0"
    },
    "hasAssembly": true,
    "parts": [
      {
        "name": "Internal frame",
        "qty": 1
      },
      {
        "name": "Bottom cover",
        "qty": 1
      },
      {
        "name": "Top cover (no ears)",
        "qty": 1
      },
      {
        "name": "Joint R1",
        "qty": 1
      },
      {
        "name": "Joint R2",
        "qty": 1
      },
      {
        "name": "Joint R3",
        "qty": 1
      },
      {
        "name": "Joint R4",
        "qty": 1
      },
      {
        "name": "Joint L1",
        "qty": 1
      },
      {
        "name": "Joint L2",
        "qty": 1
      },
      {
        "name": "Joint L3",
        "qty": 1
      },
      {
        "name": "Joint L4",
        "qty": 1
      }
    ],
    "bought": 9
  }
];
export const kitMetaPartCount = (k: KitMeta) => k.parts.reduce((n, p) => n + p.qty, 0);
