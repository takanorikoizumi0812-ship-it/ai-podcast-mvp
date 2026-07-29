import { writeFile } from "node:fs/promises";

export const MAX_TTS_CHARS = 1000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function splitAtBoundaries(text: string, boundaries: RegExp): string[] {
  return text.split(boundaries).map((piece) => piece.trim()).filter(Boolean);
}

function forceSplit(text: string): string[] {
  const result: string[] = [];
  for (let start = 0; start < text.length; start += MAX_TTS_CHARS) result.push(text.slice(start, start + MAX_TTS_CHARS));
  return result;
}

export function splitForSpeech(text: string): string[] {
  if (!/[\p{L}\p{N}]/u.test(text)) throw new Error("Speech text must contain readable characters.");
  const sentences = splitAtBoundaries(text, /(?<=[。！？!?])\s*/u);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_TTS_CHARS) { chunks.push(sentence); continue; }
    const clauses = splitAtBoundaries(sentence, /(?<=[、,，\n])\s*/u);
    for (const clause of clauses) {
      if (clause.length <= MAX_TTS_CHARS) { chunks.push(clause); continue; }
      const words = splitAtBoundaries(clause, /\s+/u);
      if (words.length > 1) {
        let current = "";
        for (const word of words) {
          if ((current + (current ? " " : "") + word).length > MAX_TTS_CHARS) { if (current) chunks.push(current); current = word; }
          else current += `${current ? " " : ""}${word}`;
        }
        if (current) chunks.push(...(current.length <= MAX_TTS_CHARS ? [current] : forceSplit(current)));
      } else chunks.push(...forceSplit(clause));
    }
  }
  const nonEmpty = chunks.filter((chunk) => /[\p{L}\p{N}]/u.test(chunk));
  if (nonEmpty.length === 0) throw new Error("Speech text produced no readable chunks.");
  return nonEmpty;
}

export type SpeechRequest = { text: string; voice: string; speed: number; instructions: string; outputPath: string; fetchImpl?: typeof fetch };

export async function synthesizeSpeech(input: SpeechRequest): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Add it to your environment before rendering.");
  const fetchImpl = input.fetchImpl ?? fetch;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ model: "gpt-4o-mini-tts", input: input.text, voice: input.voice, speed: input.speed, response_format: "wav", instructions: input.instructions })
      });
      if (response.ok) { await writeFile(input.outputPath, Buffer.from(await response.arrayBuffer())); return; }
      const detail = (await response.text()).slice(0, 500);
      if (!RETRYABLE_STATUSES.has(response.status)) {
        const error = Object.assign(new Error(`Speech API failed (${response.status}): ${detail}`), { retryable: false });
        throw error;
      }
      lastError = new Error(`Speech API failed (${response.status}): ${detail}`);
    } catch (error) {
      if (typeof error === "object" && error !== null && "retryable" in error && error.retryable === false) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError" || lastError.name === "TimeoutError") lastError = new Error("Speech API timed out after 45 seconds.");
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
  }
  throw lastError ?? new Error("Speech API failed after retries.");
}
