// Every character the build-time cards (app/_og, app/_icons) may draw.
//
// The bundled Inter files are subsets of exactly this set. They used to be
// subsets of the card's own words, so any new word rendered as blanks until
// someone remembered `pnpm fonts:og`. Printable ASCII plus the few symbols the
// card uses covers any English copy; tests/og-card.test.ts fails when the card
// asks for a character outside it.

const ASCII = Array.from({ length: 95 }, (_, i) =>
  String.fromCharCode(32 + i)
).join('')

export const OG_GLYPHS = `${ASCII}·—•★✓`

export const OG_FONT_WEIGHTS = [500, 700, 900]
