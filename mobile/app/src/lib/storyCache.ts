import type { Tone } from '../ui/NewsParts';

export type StoryView = {
  id: string;
  headline: string;
  summary?: string | null;
  url?: string | null;
  place?: string | null;
  source?: string | null;
  time?: string | null;
  tone: Tone;
  urgent?: boolean;
  imageUrl?: string | null;
  sources?: { publisher?: string; url?: string }[];
};

// The list already holds the full story, so the detail page opens instantly from here (there is no single-story endpoint).
const cache = new Map<string, StoryView>();

export function rememberStory(s: StoryView): string {
  cache.set(s.id, s);
  return s.id;
}

export function getStory(id?: string): StoryView | undefined {
  return id ? cache.get(id) : undefined;
}
