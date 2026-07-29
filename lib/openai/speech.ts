import { writeFile } from "node:fs/promises";

const MAX_TTS_CHARS = 1000;

export function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^。！？!?]+[。！？!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > MAX_TTS_CHARS) throw new Error("A sentence exceeds the 1,000-character TTS safety limit.");
    if ((current + sentence).length > MAX_TTS_CHARS) {
      if (current) chunks.push(current);
      current = sentence;
    } else current += sentence;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function synthesizeSpeech(input: { text: string; voice: string; speed: number; instructions: string; outputPath: string }): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Add it to your environment before rendering.");
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", input: input.text, voice: input.voice, speed: input.speed, response_format: "mp3", instructions: input.instructions })
  });
  if (!response.ok) throw new Error(`Speech API failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  await writeFile(input.outputPath, Buffer.from(await response.arrayBuffer()));
}
