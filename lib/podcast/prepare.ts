import { createHash, randomUUID } from "node:crypto";
import { podcastSchema, type Podcast, type PodcastSegmentType } from "../schemas/podcast";
import { splitForSpeech } from "../openai/speech";

export type ScriptSection = { id?: string; type?: PodcastSegmentType; text: string };
export type PodcastPreparationInput = { title: string; description?: string; targetDurationSec?: number; sections: ScriptSection[]; voice?: Podcast["audioSettings"]["voice"]; speed?: number };

const defaultTypes: PodcastSegmentType[] = ["hook", "theme", "experience", "claim", "counterargument", "conclusion", "takeaway"];

export function preparePodcast(input: PodcastPreparationInput): Podcast {
  const title = input.title.trim();
  if (!title) throw new Error("Script title is required.");
  if (!Array.isArray(input.sections) || input.sections.length === 0) throw new Error("At least one script section is required.");
  const segments = input.sections.flatMap((section, sectionIndex) => splitForSpeech(section.text).map((text, pieceIndex) => ({
    id: `${section.id?.trim() || `section_${String(sectionIndex + 1).padStart(2, "0")}`}_${String(pieceIndex + 1).padStart(2, "0")}`,
    type: section.type ?? defaultTypes[Math.min(sectionIndex, defaultTypes.length - 1)],
    text,
    voiceInstructions: "自然で落ち着いた話し方。考えながら話している印象。",
    pauseBeforeMs: 0,
    pauseAfterMs: pieceIndex === splitForSpeech(section.text).length - 1 ? 700 : 250
  })));
  const estimatedDurationSec = Math.max(1, Math.round(segments.reduce((total, segment) => total + segment.text.length / 5.5 + (segment.pauseAfterMs / 1000), 0)));
  const episodeId = `episode_${createHash("sha256").update(`${title}\0${segments.map((segment) => segment.text).join("\0")}`).digest("hex").slice(0, 16)}`;
  const podcast = {
    episode: { id: episodeId, title, description: input.description?.trim() || title, format: "solo" as const, language: "ja-JP" as const, targetDurationSec: input.targetDurationSec ?? estimatedDurationSec },
    audioSettings: { voice: input.voice ?? "alloy", speed: input.speed ?? 1, outputFormat: "mp3" as const, backgroundMusic: false as const },
    segments
  };
  return podcastSchema.parse(podcast);
}
