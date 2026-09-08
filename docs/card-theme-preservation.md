# Source-preserving card decoration

This implementation follows DESIGN.md; it does not replace its layout or gear-copy rules.

## Preservation contract

- Keep original uploaded blobs in IndexedDB. Decorations must never rewrite them.
- Treat background-removal output as an alpha mask only, for both server and browser results.
- Reject mismatched dimensions; never silently rescale the subject or mask.
- Retain decoded source RGB and cap output alpha at source alpha.
- A mask can still misclassify hair or equipment. Manual inspection and original restore remain necessary.
- Canvas PNG encoding may round RGB at translucent edges. Source blob identity, pre-encoding RGB preservation, and exported composition fidelity are separate checks.
- Existing user-selected fit, position and zoom remain available. Theme selection must never change them.

## Theme production brief

Use the public XXD Panel 148 and 207 repositories as visual-language references
for the two independent material systems; do not ship their sample images or
run a full poster generator for each user card. Material boards are generated
once for this project and then consumed by the deterministic compositor. Do not
supply character screenshots to the material generator. Generate no people,
equipment, text, numbers, logos, or item icons. Keep central subject and copy
areas quiet. Prefer edge texture and restrained print details.

Implement material layers with the existing pattern/texture axes. Avoid a second
template picker: DESIGN.md explicitly makes direct background controls the only
source of truth. A theme is a pattern choice plus the user's independent solid
color and texture choices; it never owns typography, image placement, or
equipment data.

## Next implementation gates

`기록의 조각` is the kraft/archive system. It uses the direct linen / collage /
grain selections and the generated
`assets/themes/materials/archive-paper-material-v1.webp` board, torn note masks,
translucent tape, and archival stamp marks. It is intentionally denser and
warmer than the other system.

`푸른 여백` is the airy editorial system. It uses the direct paper / scrapbook /
grain selections and `assets/themes/materials/airy-paper-material-v1.webp`, pale paper notes,
fine registration marks, and restrained tape. It keeps the hero image and open
space dominant instead of borrowing the archive system's kraft, stamp, or ticket
language.

Both material boards are text-free and image-free with respect to user content.
The preview and PNG renderer load the same board and use the same note geometry.
No source image pixels, item names, or user typography are sent through a
generated material asset.

1. Source protection: alpha-only application and regression tests.
2. Audit existing CardPng / DOM preview / CardLayout paths before changing them.
   Shared calculations already exist; do not assume wholesale replacement is needed.
3. Produce and visually review `기록의 조각` and `푸른 여백` using the
   existing axes and text-free material assets.
4. Verify one through five characters, long multilingual gear names, opaque copy
   areas, portrait/landscape, and mobile layouts against preview/export checks.
5. Add more themes only after the first passes. Publishing is a separate action.
