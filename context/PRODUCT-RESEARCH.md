# PrintPro3D product research (2026-11-24)

Scope: small printable parts that sell in India, template list, motor-test feature, "buy instead" links. Existing: 7 catalog items (pawn, cable clip, Pi case base, spinner head, drone plate, phone stand, shelf bracket). Bed 220x220x250 mm; PLA/PETG/ABS/TPU.
Evidence quality: no source publishes real unit-sales numbers (Etsy/Printables/Amazon.in show reviews or badges only). Rankings below are judgment from repeated category mentions + Indian seller service pages. NOT VERIFIED: Amazon.in bestseller ranks, blaster3d.in/Robu.in catalogues (not reached), any INR band below (derived from Rs 3-12/g service rates, unconfirmed on seller sites).

## Ranked templates (demand x ease x 220 mm fit; P = parametric, F = fixed)
| # | Template | Short description | Material / colour | INR band | Type |
|---|---|---|---|---|---|
| 1 | Electronics enclosure box + lid | Box for Arduino/ESP32/PCB, standoffs, cut-outs | PETG black/grey | 199-699 | P |
| 2 | Raspberry Pi / Arduino case (full, w/ lid) | Extend existing Pi base with lid + vents | PETG black | 299-599 | P (board pick) |
| 3 | Gridfinity-style storage bin | Modular desk/drawer bin, 42 mm grid | PLA any | 49-249 | P |
| 4 | Phone / tablet stand | Exists; add angle + width + cable hole | PLA white/black | 149-349 | P |
| 5 | Cable clip / organiser | Exists; add cable dia + count | PETG/TPU black | 29-99 (packs) | P |
| 6 | Name keychain / tag | Text on plate, ring hole | PLA 2-colour | 49-149 | P (text) |
| 7 | Desk nameplate / sign | Raised text on base | PLA 2-colour | 199-499 | P (text, length) |
| 8 | Drone camera / GoPro mount | 5" quad TPU action-cam mount, tilt angle | TPU black | 149-349 | P (angle) |
| 9 | Drone frame plate / arm | Exists; add prop size 3-5", motor pattern | ABS/PETG (CF-PETG later) | 299-799 | P |
| 10 | TPU antenna / XT60 / battery strap mounts | Small FPV protectors | TPU | 49-149 | F |
| 11 | Motor mount (N20 / TT / BLDC) | Bracket with screw pattern | PETG | 79-199 | P (motor type) |
| 12 | Wheel / tyre for TT & N20 motors | Hub fits D-shaft, TPU tyre | PLA hub + TPU | 99-249/pair | P (dia, shaft) |
| 13 | RC car body shell (1:24-1:28) | Shell fitting chassis wheelbase | PLA/PETG red/blue | 499-1499 | P (wheelbase, width) |
| 14 | Spacer / standoff / washer set | M2-M5 spacers, any length | PETG/PLA | 29-149 | P |
| 15 | Knob / replacement cap | Pot/appliance knob, D or round shaft | PLA/PETG black | 49-149 | P (shaft) |
| 16 | Shelf / L bracket | Exists; add size, hole dia | PETG | 149-299 | P |
| 17 | Headphone hook (under-desk / clamp) | Clamp to 10-40 mm desk | PETG black | 199-399 | P (desk thickness) |
| 18 | Wall hook / key holder | Screw or adhesive hook | PLA/PETG | 49-199 | P (load size) |
| 19 | Pegboard / tool holder | Pegboard hooks, pliers holder | PETG | 79-249 | F |
| 20 | Plant pot / planter with drain | Small succulent pot | PLA/PETG white/terracotta | 199-599 | P (dia, height) |
| 21 | Fidget / articulated toy (own design) | Flexi toy, spinner (exists) | PLA multicolour | 149-399 | F |
| 22 | Chess / board-game pieces | Pawn exists; full set | PLA 2 colours | 99 each / 999-1999 set | F |
| 23 | Dice tower / card holder | Tabletop accessory | PLA | 299-799 | F |
| 24 | Cookie / rangoli cutter | Outline shape cutter (food-safe caveat) | PETG | 99-299 | P (shape, size) |
| 25 | Toothbrush / soap holder | Bathroom organiser w/ drain | PETG white | 149-349 | F |
| 26 | Lithophane / photo night-light panel | Photo-to-relief (needs pipeline) | PLA white | 499-1299 | P (photo) - later |
Avoid: character/brand figurines (IP), weapons replicas, structural load-bearing claims, food-contact claims without food-safe resin/coating.

## Recommended first 10 (parametric fields)
1. Enclosure box: inner L/W/H (mm), wall 1.6-3, lid (snap/screw), standoff pattern (preset Arduino Uno/ESP32/custom), cut-outs (USB/DC/hole list), vents y/n.
2. Pi/Arduino full case: board (Pi 4/5, Zero, Uno, Nano), lid y/n, GPIO slot y/n, fan 30/40 mm.
3. Storage bin (Gridfinity-compatible): units X x Y (1-5), height units (3-12), dividers count, label tab y/n.
4. Phone/tablet stand: device thickness 7-15, angle 50-75 deg, width, cable hole y/n.
5. Cable clip: cable dia 3-12, slots 1-5, mount (adhesive pad/screw).
6. Name keychain: text (<=12 chars), font (2-3 open fonts), plate length, 2-colour y/n.
7. Drone camera mount: camera (GoPro/Insta360 Go/naked), tilt 0-40 deg, strap width 15/20, TPU forced.
8. Motor mount: motor (N20, TT, 2204/2306 16x16/16x19/M3), base screw spacing, thickness.
9. Wheel for TT/N20: diameter 30-80, width, shaft (TT double-D / N20 3 mm D), tyre TPU y/n.
10. Spacer/standoff set: screw M2/M2.5/M3/M4, OD, length 2-40, quantity.
Then RC body shell (wheelbase, track width, height) once the builder supports shells.

## Motor power test + animation (scope)
- Data: small curated table per motor+prop+voltage: throttle %, rpm, thrust g, current A, power W, g/W. Seed from manufacturer tables (e.g. RCINPOWER GTS 2306 2400KV on 5x5x3 @21 V: 52 A, 2087 g, 1092 W per maker; NOT independently verified) and our own bench runs. Gear motors (N20/TT): no-load rpm, no-load/stall current, stall torque from Pololu/Adafruit/DFRobot sheets (e.g. Adafruit TT 1:48: 6 V 160 mA @250 rpm, 1.5 A stall).
- Model: interpolate measured points; only extrapolate with T = k*rpm^2 (k fit per prop from >=3 points), P_elec = V*I, efficiency g/W = T/P; DC motor: rpm ~ no-load rpm*(1 - torque/stall torque), current linear in torque. Label every curve "measured" vs "model".
- Animation: throttle slider -> spinning prop/wheel at scaled rpm, thrust arrow + live V, A, W, g/W; warn when current > ESC/battery rating or thrust/weight < 2 (5" quad).
- Honest claims: "typical values from manufacturer/bench data, +/-10-20%"; real results vary with KV tolerance (reviews measured 2350-2420 KV on "2450 KV" motors), battery sag, prop batch, temperature. Never "certified" or guaranteed flight time.
- Licensing: copy no tables wholesale. UIUC prop DB and Tyto database are viewable but reuse terms unclear (Tyto: no data licence found; UIUC: academic, cite) -> link out, store only numbers we measured or that a manufacturer published for its own product, with citation. Best long-term: own thrust stand (load cell + current sensor, ~Rs 3-6k BOM, unverified) and publish our own data.

## "Available in market until we build ours"
- Show a "Buy ready-made" box with: generic product name, typical INR range we noted ourselves (date-stamped "checked on DD-MM"), and plain outbound links to the seller search/product page (no scraped images, descriptions, reviews or live prices).
- Use affiliate links only with disclosure ("we may earn a commission"); Amazon Associates restricts showing stored/cached prices (from memory, NOT VERIFIED for India: check its Operating Agreement), so prefer ranges or no price.
- Label clearly: "Not made by PrintPro3D", and say why ours differs (custom size, material) - no fake comparisons.
- Keep a per-item `marketLinks: {label, url, checkedOn, priceBand?}` array; re-check quarterly; drop dead links.

## Sources
- Zbotic printing service / drone 3DP guides: https://zbotic.in/3d-printing-service-india/ , https://zbotic.in/drone-3d-printing-camera-mounts-pods-and-accessories/ , https://zbotic.in/3d-printing-service-comparison-india-2026-zbotic-vs-a3dxyz-vs-3ding-and-more/ (3Ding ~Rs 3-5/g PLA, min Rs 300: aggregator claim)
- Robocraze drone parts in India: https://robocraze.com/blogs/post/3d-printed-drone-parts-how-makers-in-india-build-custom-frames-and-mounts-for-diy-robots
- Etsy own-design rule + bestseller categories: https://3dprinterly.com/10-3d-prints-that-actually-sell-right-now-etsy/ , https://hyper3d.ai/blog/best-selling-3d-printed-items , https://www.etsy.com/market/best_selling_items_3d_print
- Gridfinity: https://github.com/jeffbarr/gridfinity-catalog , https://www.printables.com/model/210548-filled-in-gridfinity-boxes-for-customization
- Thrust bench reviews: https://miniquadtestbench.com/geprc-speedx-gr2306-2450kv.html , https://miniquadtestbench.com/brotherhobby-tornado-t3-2306-2450kv.html ; maker table: https://rcdrone.top/products/rcinpower-gts-2306-brushless-fpv-motor-2400kv-2750kv-3-5s-racing-edition-for-5-inch-drone
- Databases: https://database.tytorobotics.com/ , https://m-selig.ae.illinois.edu/props/propDB.html
- Gear motors: https://www.adafruit.com/product/3777 , https://docs.sunfounder.com/projects/3in1-kit-v2/en/latest/components/component_tt_motor.html , https://www.pololu.com/file/0J1487/pololu-micro-metal-gearmotors.pdf , https://kamami.pl/en/micro-metal-gearmotors/582339-n20m-6v-100rpm.html
Not reached: blaster3d.in, Robu.in, Amazon.in bestseller pages, 2204 motor tables (add later).
