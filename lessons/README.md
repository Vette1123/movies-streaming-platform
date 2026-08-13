# Lessons

One file per finished unit of work: `lessons/YYYY-MM-DD-slug.md`.

Sections: **What / Mistakes / What worked / Rules.**

The **Mistakes** section is the point — git already records what was built. Write
down the wrong turn: the assumption that turned out false, the thing verified the
wrong way, the fix that nearly shipped, the code written and then thrown away. If
a unit of work genuinely had no wrong turn, say so in one line and keep it short.

Read the lessons touching an area before starting work in it. Commit the lesson
with the work, not after.

| Date       | Lesson                                                                 | The one thing                                                                                  |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2026-08-13 | [Image CDN fallback quality](2026-08-13-image-cdn-fallback-quality.md) | The fallback CDN was never worse per pixel — it was asking for the wrong width, and upscaling. |
