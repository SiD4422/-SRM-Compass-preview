import storiesDataRaw from '../../data/stories.json';
import programmesDataRaw from '../../data/programmes.json';

export interface StoryFact {
  text: string;
  source_id: string;
  captured_on: string;
  tier: 'sourced' | 'verified';
}

export interface StorySource {
  id: string;
  title: string;
  url: string;
  kind: string;
  captured_on: string;
  note?: string;
}

export interface Story {
  id: string;
  title: string;
  kind: string;
  programme_slugs: string[];
  link_basis: string;
  facts: StoryFact[];
}

export interface StoriesFile {
  note: string;
  sources: StorySource[];
  stories: Story[];
}

export interface ProgrammeRef {
  slug: string;
  name: string;
}

export interface EnrichedStoryFact extends StoryFact {
  source?: StorySource;
}

export interface EnrichedStory extends Omit<Story, 'facts'> {
  facts: EnrichedStoryFact[];
  programmes: ProgrammeRef[];
}

const storiesData = storiesDataRaw as unknown as StoriesFile;
const programmesList = (programmesDataRaw as unknown as { programmes: ProgrammeRef[] }).programmes;

const sourcesMap = new Map<string, StorySource>();
for (const s of storiesData.sources) {
  sourcesMap.set(s.id, s);
}

const programmesMap = new Map<string, ProgrammeRef>();
for (const p of programmesList) {
  programmesMap.set(p.slug, p);
}

export function getAllStories(): EnrichedStory[] {
  return storiesData.stories.map((story) => enrichStory(story));
}

export function getStoryBySlug(slug: string): EnrichedStory | undefined {
  const story = storiesData.stories.find((s) => s.id === slug);
  if (!story) return undefined;
  return enrichStory(story);
}

export function getStoriesForProgramme(programmeSlug: string): EnrichedStory[] {
  return storiesData.stories
    .filter((s) => s.programme_slugs.includes(programmeSlug))
    .map((s) => enrichStory(s));
}

export function getStorySource(sourceId: string): StorySource | undefined {
  return sourcesMap.get(sourceId);
}

function enrichStory(story: Story): EnrichedStory {
  const facts: EnrichedStoryFact[] = story.facts.map((fact) => ({
    ...fact,
    source: sourcesMap.get(fact.source_id)
  }));

  const programmes: ProgrammeRef[] = story.programme_slugs
    .map((slug) => programmesMap.get(slug))
    .filter((p): p is ProgrammeRef => p !== undefined);

  return {
    ...story,
    facts,
    programmes
  };
}
