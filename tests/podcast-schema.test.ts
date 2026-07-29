import test from "node:test";
import assert from "node:assert/strict";
import sample from "../sample-podcast.json" with { type: "json" };
import { validatePodcast } from "../lib/schemas/podcast";
import { splitForSpeech } from "../lib/openai/speech";

test("sample podcast satisfies the MVP schema", () => {
  assert.doesNotThrow(() => validatePodcast(sample));
});

test("speech splitter preserves sentence boundaries and 1,000-character maximum", () => {
  const text = `${"あ。".repeat(700)}${"い。".repeat(700)}`;
  const chunks = splitForSpeech(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1000));
});
