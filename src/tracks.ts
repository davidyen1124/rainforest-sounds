import type { TrackId } from './bus';

export interface Track {
  id: TrackId;
  title: string;
  artist: string;
  /** Displayed duration in seconds (some of these are lies). */
  duration: number;
  /** One-line "about this track" blurb. */
  blurb: string;
}

export const TRACKS: Track[] = [
  {
    id: 'gentle-rain',
    title: 'Gentle Rain (Wet)',
    artist: 'Nature',
    duration: 192,
    blurb: 'Water, falling. Recorded in one take. The rain did not know it was being recorded.',
  },
  {
    id: 'frog-choir',
    title: 'Frog Choir (Unsolicited)',
    artist: '40 Frogs',
    duration: 167,
    blurb: 'Nobody asked the frogs. The frogs are aware nobody asked.',
  },
  {
    id: 'toucan-airstrike',
    title: 'Toucan Airstrike',
    artist: 'Toucan & The Beaks',
    duration: 118,
    blurb: 'Contains strong beak. Listener discretion advised.',
  },
  {
    id: 'sloth-asmr',
    title: 'Sloth Whispers Your Full Name (0.25x)',
    artist: 'Gary the Sloth',
    duration: 664,
    blurb: 'Gary has been whispering since 2019. He is on the second syllable.',
  },
  {
    id: 'monkey-meeting',
    title: 'Howler Monkey Quarterly All-Hands',
    artist: 'HR Department',
    duration: 260,
    blurb: 'This meeting could have been a screech.',
  },
  {
    id: 'thunder',
    title: "Thunderstorm But It's Personal",
    artist: 'The Sky',
    duration: 213,
    blurb: 'The sky read your group chat.',
  },
  {
    id: 'leaf-4h',
    title: 'One Leaf Falling (4 Hour Version)',
    artist: 'A Leaf',
    duration: 14400,
    blurb: 'Critics call it "a leaf" and "still going".',
  },
  {
    id: 'dopamine-reset',
    title: 'Dopamine Reset (Club Mix)',
    artist: 'Your Frontal Lobe',
    duration: 7,
    blurb: 'Seven seconds. Life-changing. Legally we cannot say that.',
  },
];

export const trackById = (id: TrackId) => TRACKS.find((t) => t.id === id)!;
