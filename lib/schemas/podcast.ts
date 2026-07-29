import { z } from "zod";

export const PODCAST_VOICES = ["alloy", "ash", "ballad", "cedar", "coral", "echo", "fable", "marin", "nova", "onyx", "sage", "shimmer", "verse"] as const;
export const PODCAST_SEGMENT_TYPES = ["hook", "theme", "experience", "claim", "counterargument", "conclusion", "takeaway"] as const;
export const MAX_SEGMENTS = 100;
export const MAX_PAUSE_MS = 30_000;

const speakableText = z.string().trim().min(1).refine((value) => /[\p{L}\p{N}]/u.test(value), "text must contain readable characters");

export const podcastSchema = z.object({
  episode: z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    format: z.literal("solo"),
    language: z.literal("ja-JP"),
    targetDurationSec: z.number().int().positive()
  }).strict(),
  audioSettings: z.object({
    voice: z.enum(PODCAST_VOICES),
    speed: z.number().finite().min(0.25).max(4),
    outputFormat: z.literal("mp3"),
    backgroundMusic: z.literal(false)
  }).strict(),
  segments: z.array(z.object({
    id: z.string().trim().min(1),
    type: z.enum(PODCAST_SEGMENT_TYPES),
    text: speakableText,
    voiceInstructions: z.string().trim().min(1),
    pauseBeforeMs: z.number().int().min(0).max(MAX_PAUSE_MS),
    pauseAfterMs: z.number().int().min(0).max(MAX_PAUSE_MS)
  }).strict()).min(1).max(MAX_SEGMENTS).superRefine((segments, context) => {
    const ids = new Set<string>();
    segments.forEach((segment, index) => {
      if (ids.has(segment.id)) context.addIssue({ code: "custom", message: "segment IDs must be unique", path: [index, "id"] });
      ids.add(segment.id);
    });
  })
}).strict();

export type Podcast = z.infer<typeof podcastSchema>;
export type PodcastSegmentType = Podcast["segments"][number]["type"];

export function validatePodcast(value: unknown): asserts value is Podcast {
  podcastSchema.parse(value);
}
