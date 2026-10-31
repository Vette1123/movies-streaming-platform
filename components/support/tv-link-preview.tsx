/**
 * What Kodi shows while it waits for your phone, drawn rather than screenshotted
 * so it stays sharp and follows the accent. The wording mirrors `link()` in
 * kodi/plugin.video.reely/plugin.py, and the code is the /link placeholder.
 */
export function TvLinkPreview() {
  return (
    <div
      role="img"
      aria-label="A TV showing the code BCDF-2345, to be entered on a phone at reely.space/link"
      className="rounded-2xl border border-border/70 bg-card p-2 shadow-xl"
    >
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-linear-to-br from-primary/15 to-transparent p-5 text-center">
        <p className="text-sm font-semibold">Link this TV</p>
        <p className="font-mono text-2xl font-semibold tracking-[0.15em] tabular-nums sm:text-4xl">
          BCDF-2345
        </p>
        <p className="text-sm text-muted-foreground">
          On your phone, open reely.space/link
        </p>
      </div>
    </div>
  )
}
