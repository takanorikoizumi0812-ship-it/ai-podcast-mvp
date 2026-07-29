import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { getDurationSec, runFfmpeg } from "./ffmpeg";
import { splitForSpeech, synthesizeSpeech } from "../openai/speech";
import { type Podcast, validatePodcast } from "../schemas/podcast";

export type RenderResult = { durationSec: number; targetDurationSec: number; durationDifferenceSec: number; durationRatio: number; warning?: string };

const cacheKey = (segmentId: string, text: string, voice: string, speed: number) => createHash("sha256").update(`${segmentId}\0${text}\0${voice}\0${speed}`).digest("hex");

export async function renderPodcast(podcast: Podcast, outputPath: string): Promise<RenderResult> {
  validatePodcast(podcast);
  const safeId = podcast.episode.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const outputDir = path.dirname(outputPath);
  await mkdir(outputDir, { recursive: true });
  const workDir = await mkdtemp(path.join(outputDir, `.render-${safeId}-`));
  const cacheDir = path.join(outputDir, ".tts-cache");
  await mkdir(cacheDir, { recursive: true });
  try {
    const mediaFiles: string[] = [];
    let index = 0;
    for (const segment of podcast.segments) {
      for (const [pauseMs, placement] of [[segment.pauseBeforeMs, "before"], [segment.pauseAfterMs, "after"]] as const) {
        if (placement === "after") break;
        if (pauseMs > 0) { const pausePath = path.join(workDir, `part-${index++}.wav`); await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(pauseMs / 1000), "-c:a", "pcm_s16le", pausePath]); mediaFiles.push(pausePath); }
      }
      for (const text of splitForSpeech(segment.text)) {
        const speechPath = path.join(workDir, `part-${index++}.wav`);
        const cachedPath = path.join(cacheDir, `${cacheKey(segment.id, text, podcast.audioSettings.voice, podcast.audioSettings.speed)}.wav`);
        try { await stat(cachedPath); await copyFile(cachedPath, speechPath); }
        catch { await synthesizeSpeech({ text, voice: podcast.audioSettings.voice, speed: podcast.audioSettings.speed, instructions: segment.voiceInstructions, outputPath: speechPath }); await copyFile(speechPath, cachedPath); }
        mediaFiles.push(speechPath);
      }
      if (segment.pauseAfterMs > 0) { const pausePath = path.join(workDir, `part-${index++}.wav`); await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(segment.pauseAfterMs / 1000), "-c:a", "pcm_s16le", pausePath]); mediaFiles.push(pausePath); }
    }
    const concatFile = path.join(workDir, "concat.txt");
    const mergedWav = path.join(workDir, "merged.wav");
    await writeFile(concatFile, mediaFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", concatFile, "-c:a", "pcm_s16le", mergedWav]);
    await runFfmpeg(["-i", mergedWav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "128k", outputPath]);
    const durationSec = await getDurationSec(outputPath);
    const targetDurationSec = podcast.episode.targetDurationSec;
    const durationDifferenceSec = durationSec - targetDurationSec;
    const durationRatio = durationSec / targetDurationSec;
    return { durationSec, targetDurationSec, durationDifferenceSec, durationRatio, ...(Math.abs(durationRatio - 1) > 0.1 ? { warning: `Target duration ${durationDifferenceSec > 0 ? "exceeded" : "fell short"} by ${Math.round(Math.abs(durationRatio - 1) * 100)}%` } : {}) };
  } finally { await rm(workDir, { recursive: true, force: true }); }
}

export async function loadPodcast(filePath: string): Promise<Podcast> { const value: unknown = JSON.parse(await readFile(filePath, "utf8")); validatePodcast(value); return value; }
