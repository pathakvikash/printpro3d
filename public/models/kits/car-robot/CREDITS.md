# 80's Car to Robot transformer with hubcap

- Author: SlightlyAbnormal
- Source: https://www.thingiverse.com/thing:2463084
- Licence: CC BY (Creative Commons Attribution), https://creativecommons.org/licenses/by/4.0/ (see LICENSE).
- Files: 15 of the 17 STLs: all except DualHeadBack.stl and DualHeadFront.stl (two-part head for dual extrusion; the single-part head is used).
- Modified: yes — SingleHead.stl had four edges shared by four triangles (touching surfaces); separated them with trimesh/numpy, no shape changes beyond 0.003 mm. RearOuter.stl was decimated from 188,580 to 110,000 triangles with trimesh (fast-simplification quadric decimation), bounding box within 0.002 mm, volume unchanged to 4 digits, and one touching edge separated by 0.003 mm. No holes needed closing. The other files are unmodified.
