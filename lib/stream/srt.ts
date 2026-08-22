// SRT -> WebVTT, for subtitles that arrive in the wrong dialect.
//
// External subtitle catalogs (SubDL, OpenSubtitles) hand out SRT; browsers
// want VTT. The differences are small and mechanical: a `WEBVTT` header,
// millisecond commas become dots, and the sequence-number line is dropped
// (legal as an identifier in VTT but it invites duplicate-id quirks). Cue
// text is untouched — dialogue containing "1,000" must survive exactly.

export const srtToVtt = (srt: string): string => {
  const blocks = srt
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)

  const cues: string[] = []
  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(Boolean)
    if (!lines.length) continue
    // A leading bare integer is SRT's cue counter. Timing lines start with
    // digits too — but contain `-->` — so this can never eat a real cue.
    if (/^\d+$/.test(lines[0]) && lines[0].length < 6) lines.shift()
    if (!lines.some((line) => line.includes('-->'))) continue
    cues.push(lines.join('\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'))
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}
