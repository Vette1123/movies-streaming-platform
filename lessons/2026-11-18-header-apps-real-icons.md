# Header "Our apps" trigger shows the real app icons

## What
The header's apps trigger was a generic phone glyph. It now shows Rafiq, Masareef and Nafis's own launcher icons, overlapped and ringed in the page colour, matching the Social Downloader footer's `PlayAppsMenu`. It reuses `APP_ICONS`, so there is no new asset or component.

## Mistakes
- The first version squeezed three 16px icons with an 8px overlap into the fixed 36px icon button so the header would not get wider. In the browser they came out as three unreadable dots. They are now 20px with a 6px overlap, and the button is `w-auto px-1.5`, 60px wide.

## What worked
- Starting from the sibling project's working trigger instead of designing a new one.

## Rules
- Size overlapped icon stacks from a screenshot, not from arithmetic: a ~16px icon that is half covered stops being recognisable.
