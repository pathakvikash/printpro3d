# Product photos

Real photos of the parts we print. Until a photo is added, the shop shows the live 3D preview.

## Adding one
1. Photograph the actual printed part (not a render), with a hand in frame for scale.
2. Save as JPG, 1200x900 (4:3), plain background, natural light (by a window, no flash).
3. Name it after the item id in `src/lib/catalog.ts`, e.g. `public/photos/pawn.jpg`, `cable-clip.jpg`, `pi-case.jpg`, `spinner-toy.jpg`, `drone-plate.jpg`, `phone-stand.jpg`, `shelf-bracket.jpg`.
4. In `src/lib/catalog.ts`, add one line to that item: `photo: '/photos/pawn.jpg'` (optionally `photoAlt: 'Printed pawn in white PLA held in a hand'`).

Only set `photo` once the file is in this folder, or the card will show a broken image. The "View in 3D" button stays on every card.
