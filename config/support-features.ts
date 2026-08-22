import {
  BadgeCheck,
  BellRing,
  Bookmark,
  CalendarDays,
  EyeOff,
  Hourglass,
  ListMusic,
  ListVideo,
  MessageSquare,
  MonitorPlay,
  Palette,
  RefreshCw,
  Server,
  Sparkles,
  Star,
  ThumbsDown,
  Upload,
  UserRound,
  Wand2,
} from 'lucide-react'

import { SUPPORT_EMAIL } from '@/config/support'

/**
 * Every supporter feature, written once.
 *
 * It lived inline in app/support/page.tsx, which meant the page that SELLS the
 * features and the panel a supporter sees after paying described them from two
 * different lists — and the second one had drifted into a single run-on
 * sentence that named nine of the thirteen. A supporter checking what they get
 * was reading a worse description than the stranger deciding whether to buy.
 *
 * Ordered by what actually decides the purchase, not by when it was built.
 */
export interface SupportFeature {
  Icon: React.ComponentType<{ className?: string }>
  /** Sentence-shaped, because it is the claim, not a category label. */
  title: string
  body: string
  /** One line, for the supporter checklist where the body is too much. */
  short: string
}

/**
 * The three that carry the page.
 *
 * Separate from the rest because the layout treats them differently, not
 * because they are worth more: these are the ones somebody who has never paid
 * can understand from the title alone, so they get the room to be shown rather
 * than listed.
 */
export const FLAGSHIP_FEATURES: SupportFeature[] = [
  {
    Icon: Sparkles,
    title: 'The Reely Player',
    short: 'Our own player — faster starts, resume, subtitles in your language',
    body: 'A player Reely builds and runs itself, instead of borrowing someone else’s. It starts faster than the embed servers, picks up where you stopped — even mid-episode, on another device — and pulls real subtitles onto titles that ship with none: Arabic, English, French, Turkish and more, sized the way you like. Set your language once and every title you open already has it on.',
  },
  {
    Icon: RefreshCw,
    title: 'One library, every screen, forever',
    short: 'Library, history and episodes synced across every device',
    body: 'Saved titles, watch history and every episode you have ticked off, kept in step across your phone, your laptop and the browser on the TV — within seconds, in both directions, without a sync button. Start something in bed, finish it at your desk. Clear your browser, lose your phone, buy a new laptop: sign in and it is all still there, exactly as you left it.',
  },
  {
    Icon: ListVideo,
    title: 'Never ask “which episode was I on”',
    short: 'A Next Up row that knows the exact episode you are on',
    body: 'A row across the top of the homepage with every show you have going — the exact episode you are up to, how far through you are, one tap from playing. Worked out from the episodes you have already ticked off, so there is nothing to set up.',
  },
  {
    Icon: CalendarDays,
    title: 'Your watchlist, in your real calendar',
    short: 'A private calendar feed with a reminder the morning before',
    body: 'A private link Google Calendar, Apple Calendar or Outlook subscribes to once — then every dated episode and release day turns up in the calendar you already live in, with a reminder the morning before. Save a show tonight and next season’s premiere appears months from now.',
  },
]

/** Everything else, in the order it is worth reading. */
export const SUPPORT_FEATURES: SupportFeature[] = [
  {
    Icon: Wand2,
    title: 'Suggestions that read your history',
    short: 'Recommendations built from what you actually finished',
    body: 'Not “more like the page you are on” — what to watch tonight, worked out from the last films and shows you actually finished, with everything already on your watchlist or in your history taken back out. Each one tells you which of your titles it came from.',
  },
  {
    Icon: Server,
    title: 'A stalled stream is not the end of the night',
    short: 'Every backup server, one-tap switching, automatic failover',
    body: 'Streams come from a third party, and third parties have bad days. Supporters get every backup server Reely has: one tap to switch, an automatic hop the moment one stops responding, and a memory of which server worked for which title.',
  },
  {
    Icon: BellRing,
    title: 'Told the day it lands',
    short: 'Notifications for new episodes and release days',
    body: 'A notification the day a new episode of something you follow is out, and the day a film you saved reaches its release date. No feed to check, no date to remember, nothing missed because it aired on a Tuesday.',
  },
  {
    Icon: MonitorPlay,
    title: 'The day it lands on a service you pay for',
    short: 'An alert when a saved title reaches a service in your country',
    body: 'Save a film that is not streaming anywhere yet, and hear about it the day it arrives on Netflix, Max, Disney+ or anything else with a subscription, in the country you picked. Rentals and purchases never count — a film has been rentable since release, and that is not news.',
  },
  {
    Icon: EyeOff,
    title: 'Stop reading the next episode’s title',
    short: 'Episode titles hidden until you have watched them',
    body: 'The season list sits directly under the player, and every episode title in it is a thing that has not happened to you yet. Hide the names of episodes you have not ticked off — they read as “Episode 4” until you watch them, with one tap to reveal any of them. It rides your account, so it is already on wherever you sign in.',
  },
  {
    Icon: ThumbsDown,
    title: 'Never shown the same thing you keep skipping',
    short: 'Dismiss a title and it stops appearing, on every device',
    body: 'One tap on any suggestion and it is gone from your recommendations and out of your browse results, everywhere you sign in. Everything you have dismissed stays listed in your account, with its poster, so a mis-tap on a phone is one tap to undo rather than a decision you can never find again.',
  },
  {
    Icon: Bookmark,
    title: 'The filter you keep rebuilding, saved once',
    short: 'Save a browse filter under a name and reopen it anywhere',
    body: 'Horror from the nineties, rated over 7, on the services you actually have — build it once, give it a name, and it is a single tap from the filter panel on every device you sign in on.',
  },
  {
    Icon: Hourglass,
    title: 'Hours watched, measured rather than guessed',
    short: 'Real runtimes behind your totals, not an average per episode',
    body: 'Everyone gets an estimate from an average film and an average episode. Supporters get the real runtime of every title, counted across every device — and the page tells you what share of it is exact rather than presenting a guess as a fact.',
  },
  {
    Icon: Star,
    title: 'Your own score, on everything',
    short: 'Rate anything out of ten, with a note, on every device',
    body: 'Rate anything out of ten and leave yourself a line about why. It sits with the title everywhere it appears and follows you to every device — so a watch history stops being a log and becomes something you can look back through.',
  },
  {
    Icon: Upload,
    title: 'Bring your Letterboxd or IMDb library with you',
    short: 'Letterboxd and IMDb CSV import, read on your own device',
    body: 'Years of ratings and a watchlist you have been adding to forever, read straight in from their CSV export and matched to real titles, with your scores carried onto the ten-point scale. The file is read on your own device and never uploaded.',
  },
  {
    Icon: UserRound,
    title: 'A page of your own',
    short: 'reely.space/u/you — your films, at one address you can send',
    body: 'One address — reely.space/u/your-name — with everything you have finished, the titles you rated highest and every list you published, under your name and your photo. It unfurls properly wherever you paste it, and a switch takes it down again. Your watchlist, your history and your email never appear on it.',
  },
  {
    Icon: ListMusic,
    title: 'Lists worth sharing',
    short: 'Publish lists as real links that unfurl with poster art',
    body: 'Build collections out of your own library, put a note and a score on anything worth one, then publish a list as a real link that unfurls with poster art wherever you paste it. Unpublish and it is gone; publish again and the same link works.',
  },
  {
    Icon: Sparkles,
    title: 'Your year, as a card worth posting',
    short: 'A shareable year card drawn on your own device',
    body: 'Hours watched, films finished, episodes ticked off, longest streak, busiest month — drawn into an image on your own device, ready for a story or a group chat. Counted across every device you use rather than whichever browser you happen to be in.',
  },
  {
    Icon: Palette,
    title: 'Six accents and a denser layout',
    short: 'Six accent colours and a compact layout, saved to your account',
    body: 'Small, and the thing you will see every single session. It rides on your account, so every device you sign in on already looks the way you like it.',
  },
  {
    Icon: BadgeCheck,
    title: 'Never asked again',
    short: 'Every support prompt switched off, permanently',
    body: 'The moment support lands, Reely stops asking. No prompts, no banners, no reminders — the supporter badge goes on your account and the subject never comes up again.',
  },
  {
    Icon: MessageSquare,
    title: 'A direct line',
    short: `${SUPPORT_EMAIL} reaches one person, who answers it himself`,
    body: `Write to ${SUPPORT_EMAIL} about anything — a billing problem, a bug, or a feature you think should exist. It reaches one person and I answer it myself. Supporters are a short list, so this is a real promise rather than a nice sentence.`,
  },
]

/** Everything, in reading order, for surfaces that show the whole set. */
export const ALL_SUPPORT_FEATURES: SupportFeature[] = [
  ...FLAGSHIP_FEATURES,
  ...SUPPORT_FEATURES,
]
