import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
import { loadPodcast, renderPodcast } from "../lib/audio/render-podcast";

async function main() {
  const root = process.cwd();
  const source = path.join(root, "sample-podcast.json");
  const destination = path.join(root, "generated", "sample-output.mp3");
  await mkdir(path.dirname(destination), { recursive: true });
  const podcast = await loadPodcast(source);
  console.log("台本を音声用に分割しています");
  console.log("音声を生成しています");
  const result = await renderPodcast(podcast, destination);
  const output = await stat(destination);
  if (output.size === 0 || result.durationSec <= 0) throw new Error("Generated MP3 is empty or has no duration.");
  console.log(`完成しました: ${destination} (${result.durationSec.toFixed(1)}秒, ${output.size} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
