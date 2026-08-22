import { describe, expect, it } from 'vitest'

import { srtToVtt } from '@/lib/stream/srt'

describe('srtToVtt', () => {
  it('converts a basic SRT with numbered cues', () => {
    const srt = [
      '1',
      '00:01:02,500 --> 00:01:04,800',
      'Hello there.',
      '',
      '2',
      '00:01:05,000 --> 00:01:07,250',
      'General Kenobi.',
    ].join('\n')

    expect(srtToVtt(srt)).toBe(
      'WEBVTT\n\n00:01:02.500 --> 00:01:04.800\nHello there.\n\n00:01:05.000 --> 00:01:07.250\nGeneral Kenobi.\n'
    )
  })

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    const srt = '\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nLine.\r\n'
    expect(srtToVtt(srt)).toBe(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLine.\n'
    )
  })

  it('keeps dialogue containing digits and commas untouched', () => {
    const srt =
      '1\n00:00:01,000 --> 00:00:02,000\nIt cost 1,000 dollars, twice.'
    const vtt = srtToVtt(srt)
    expect(vtt).toContain('00:00:01.000 --> 00:00:02.000')
    // The dialogue line survives verbatim, commas and all.
    expect(vtt).toContain('It cost 1,000 dollars, twice.')
  })

  it('survives cues without a sequence number and trailing blank lines', () => {
    const srt = '00:00:03,000 --> 00:00:04,000\nNo index.\n\n\n'
    expect(srtToVtt(srt)).toBe(
      'WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nNo index.\n'
    )
  })
})
