export type PodcastSegmentType =
  | "hook"
  | "theme"
  | "experience"
  | "claim"
  | "counterargument"
  | "conclusion"
  | "takeaway";

export type Podcast = {
  episode: {
    id: string;
    title: string;
    description: string;
    format: "solo";
    language: "ja-JP";
    targetDurationSec: number;
  };
  audioSettings: {
    voice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer" | "verse";
    speed: number;
    outputFormat: "mp3";
    backgroundMusic: false;
  };
  segments: Array<{
    id: string;
    type: PodcastSegmentType;
    text: string;
    voiceInstructions: string;
    pauseBeforeMs: number;
    pauseAfterMs: number;
  }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validatePodcast(value: unknown): asserts value is Podcast {
  if (!isRecord(value) || !isRecord(value.episode) || !isRecord(value.audioSettings) || !Array.isArray(value.segments)) {
    throw new Error("Podcast JSON must include episode, audioSettings, and segments.");
  }
  const { episode, audioSettings, segments } = value;
  if (episode.format !== "solo" || episode.language !== "ja-JP" || typeof episode.id !== "string" || typeof episode.title !== "string" || typeof episode.description !== "string" || !Number.isFinite(episode.targetDurationSec)) {
    throw new Error("episode has invalid or missing required fields.");
  }
  const speed = audioSettings.speed;
  if (audioSettings.outputFormat !== "mp3" || audioSettings.backgroundMusic !== false || typeof audioSettings.voice !== "string" || typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.25 || speed > 4) {
    throw new Error("audioSettings has invalid or missing required fields.");
  }
  if (segments.length === 0) throw new Error("Podcast must contain at least one segment.");
  for (const segment of segments) {
    if (!isRecord(segment)) throw new Error("A segment has invalid or missing required fields.");
    const pauseBeforeMs = segment.pauseBeforeMs;
    const pauseAfterMs = segment.pauseAfterMs;
    if (typeof segment.id !== "string" || typeof segment.type !== "string" || typeof segment.text !== "string" || !segment.text.trim() || typeof segment.voiceInstructions !== "string" || typeof pauseBeforeMs !== "number" || typeof pauseAfterMs !== "number" || !Number.isInteger(pauseBeforeMs) || !Number.isInteger(pauseAfterMs) || pauseBeforeMs < 0 || pauseAfterMs < 0) {
      throw new Error("A segment has invalid or missing required fields.");
    }
  }
}
