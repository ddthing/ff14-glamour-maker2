# Glamour Atelier design contract

This file is the visual source of truth for the FF14 glamour lookbook editor.
It is intentionally small: the editor should help a creator make a card, not
make the creator manage a dashboard.

## Design read

This is a Korean-first creative editor for FFXIV screenshot creators. The
visual language is quiet editorial Neutral with controlled asymmetry, clear
image hierarchy, and a small amount of Y2K print texture in the exported card.

The working dials are:

- `DESIGN_VARIANCE: 7` for the one-person editorial composition and mirrored
  information rails.
- `MOTION_INTENSITY: 3` for feedback and state changes only.
- `VISUAL_DENSITY: 4` for a focused editor with progressive disclosure.

## Token contract

- Use the supplied Neutral OKLCH tokens as the only UI palette.
- `--primary` is the sole action and focus color. Do not add a second accent.
- Use `--background` for the page, `--card` for raised surfaces, and `--muted`
  for grouped controls.
- Use one radius scale: `--radius` for cards and panels, `--radius-sm` for
  controls and media tiles, and full radius only for compact segmented controls.
- Use Pretendard for UI and body text. Display title choices are intentional
  variants, not separate page fonts.
- Shadows are neutral and soft. Do not use glow, neon, or decorative status
  dots unless the state is meaningful.

## Information hierarchy

1. The character image is the primary subject.
2. The card title and subtitle establish the look.
3. Gear names are supporting information and never cover the character's face,
   hands, or item silhouette.
4. Technical metadata, pixel dimensions, and workflow progress are hidden or
   shown only when they help the next edit decision.

The left list is navigation for saved looks/projects, not a template picker.
It uses neutral numbered markers so it cannot be mistaken for a second style
gallery. Card styling has one source of truth in the direct controls in the
right inspector. Background styling now has one source of truth in the
three direct axes, solid, pattern, and texture. A user-owned preset may recall
only that three-part background tuple and must never change typography,
geometry, or image placement.

## Card rules

- One person defaults to a 4:5 export at `2160 x 2700`. The character sits in
  front of five staggered gear notes. Information may mirror left or right.
- Two people use a balanced 16:9 composition with side information rails:
  character 01 owns the left rail and character 02 owns the right rail. Each
  rail shows all five item names in a compact vertical list so no outfit data
  is silently replaced by the currently selected character.
- Three to five people use a centered title and lineup. Gear information is a
  deliberate alternate layer or selected-person focus, never five paragraphs
  over every figure at once.
- New cards start with Pretendard and no pattern. Y2K motifs are optional
  export decoration, not editor chrome.
- The title is an editable editorial layer over one continuous card surface.
  Never create a full-width masthead strip or a hard horizontal divider just to
  protect title contrast. Use the title glyph's optional outline, print texture,
  or a small theme-specific label so the source image and background flow
  together without a white panel behind the text.
- The preview and PNG export must use the same surface order: source images
  first, then the optional title glyph outline, then text and item information.
  Full-frame source screenshots may reach the card edges; they must not begin
  below an artificial header band.
- Silhouette mode is available only when every active character has a
  background-removed asset; otherwise the editor stays in the readable fade
  treatment and explains why.
- Gear notes in the exported card are typography-only. Do not crop body-part
  images or depend on remote item icons for the final composition.
- Gear-note copy is always left-aligned inside the note, regardless of whether
  the note sits on the left or right rail. The title may be centered; item
  information is a scanning surface, not a decorative label.
- Korean and Japanese item names include the official English name as a quiet
  secondary line when available. English mode never duplicates the name.
- Text remains in a dedicated opaque copy area with a safe margin. A character
  may approach a note but must not obscure its copy.

## Editor rules

- The right inspector exposes the smallest set of controls for the selected
  panel. Selecting a gear slot focuses item search; no crop controls are shown.
- Image import immediately follows character selection. Dropping multiple
  files fills consecutive character slots and expands the cast only as needed.
- `전체 보기` is the safe default for source images. `채우기` is an explicit
  crop choice, and zoom/position/fit are stored independently per character.
- Image placement is edited directly on the card, with compact nudge and zoom
  controls in a compact editing dock entered from the Image section.
- Each saved look owns its characters, layout, appearance, and undo history.
  A new look must never inherit the previous look's photographs.
- On mobile screens with sufficient height, keep a compact preview visible
  while scrolling the inspector. Short screens use natural document flow.
- Inspector body controls target 13–14px type, with 12px supporting text and
  16px section headings. Range inputs separate a 40px hit area from a 4px
  track and a round 20px thumb.
- Font weight uses a small set of named choices with a live glyph preview.
  Never use a numeric range slider for a discrete font-weight axis, and hide
  the control when a font ships with only one weight.
- Every destructive or slow action has a reversible state: original/cutout,
  undo/redo, loading, and an inline error message.
- Clearing a card retains assets referenced by undo. Permanent workspace
  deletion requires an explicit in-app confirmation and reports failures.
- Save user images and derived cutouts locally in IndexedDB. `localStorage`
  stores only lightweight project settings and references.
- Export is always PNG at the selected card ratio. Never silently downgrade the
  file type or dimensions.

## Component behavior

- Prefer grouped sections and whitespace over extra cards.
- Use labels above controls. Helper text should explain an action, not repeat a
  heading.
- Use Korean labels by default. The header language control changes item and
  card language globally; Korean and Japanese cards add English as secondary
  reference text.
- Use real icon glyphs or text labels already established by the prototype. Do
  not introduce a new icon family in one section.
- Motion communicates feedback or a state change and respects reduced motion.

## Stylesheet seams

- `styles.css` owns the shared workspace shell, tokens, layout primitives, and
  legacy-compatible foundations. It must not contain final card recipes.
- `styles/card-composer.css` owns card composition, ratios, themes, typography,
  image layering, and multi-character presentation.
- `styles/editor-controls.css` owns inspector-only image and typography controls.
  Its selectors must not alter anything inside `.canvas-board`.
- `styles/card-readability.css` is the final card safety layer for title
  stability, opaque gear copy, canvas sizing, and direct-manipulation cursors.
- Keep this loading order. A new visual rule must be placed at the narrowest
  seam instead of appended as another global override.

## Review checklist

- Does the card remain readable with one, two, and five characters?
- Can a user identify the selected character and selected gear slot without
  reading technical metadata?
- Does clicking a gear note open the matching slot and item search?
- Does refresh restore original images, cutouts, language, layout, and style?
- Is the most important image still the visually dominant object?
