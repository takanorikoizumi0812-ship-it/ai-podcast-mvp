import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDurationSec, runFfmpeg } from "./ffmpeg";
import { splitForSpeech, synthesizeSpeech } from "../openai/speech";
import { type Podcast, validatePodcast } from "../schemas/podcast";

export async function renderPodcast(podcast: Podcast, outputPath: string): Promise<{ durationSec: number }> {
  validatePodcast(podcast);
  const safeId = podcast.episode.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const workDir = path.join(path.dirname(outputPath), `.render-${safeId}`);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  try {
    const mediaFiles: string[] = [];
    let index = 0;
    for (const segment of podcast.segments) {
      for (const pauseMs of [segment.pauseBeforeMs]) {
        if (pauseMs > 0) {
          const pausePath = path.join(workDir, `part-${index++}.mp3`);
          await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(pauseMs / 1000), "-c:a", "libmp3lame", pausePath]);
          mediaFiles.push(pausePath);
        }
      }
      const pieces = splitForSpeech(segment.text);
      for (const text of pieces) {
        const speechPath = path.join(workDir, `part-${index++}.mp3`);
        await synthesizeSpeech({ text, voice: podcast.audioSettings.voice, speed: podcast.audioSettings.speed, instructions: segment.voiceInstructions, outputPath: speechPath });
        mediaFiles.push(speechPath);
      }
      if (segment.pauseAfterMs > 0) {
        const pausePath = path.join(workDir, `part-${index++}.mp3`);
        await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(segment.pauseAfterMs / 1000), "-c:a", "libmp3lame", pausePath]);
        mediaFiles.push(pausePath);
      }
    }
    const concatFile = path.join(workDir, "concat.txt");
    await writeFile(concatFile, mediaFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", concatFile, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "128k", outputPath]);
    return { durationSec: await getDurationSec(outputPath) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function loadPodcast(filePath: string): Promise<Podcast> {
  const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
  validatePodcast(value);
  return value;
}
