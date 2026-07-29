import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sample from "../sample-podcast.json" with { type: "json" };
import { validatePodcast } from "../lib/schemas/podcast";
import { splitForSpeech, synthesizeSpeech } from "../lib/openai/speech";
import { preparePodcast } from "../lib/podcast/prepare";

const invalid = (change: (value: any) => void) => { const value = structuredClone(sample) as any; change(value); assert.throws(() => validatePodcast(value)); };
test("sample podcast satisfies the strict MVP schema", () => assert.doesNotThrow(() => validatePodcast(sample)));
test("schema rejects invalid voice, type, duration, IDs, duplicate IDs, punctuation-only text, and invalid pauses", () => {
  invalid((v) => { v.audioSettings.voice = "not-a-voice"; });
  invalid((v) => { v.segments[0].type = "not-a-type"; });
  invalid((v) => { v.episode.targetDurationSec = -5; });
  invalid((v) => { v.episode.id = ""; });
  invalid((v) => { v.segments[1].id = v.segments[0].id; });
  invalid((v) => { v.segments[0].text = "。。"; });
  invalid((v) => { v.segments[0].pauseBeforeMs = 30_001; });
});
test("speech splitter handles punctuation-only content and very long unpunctuated text safely", () => {
  assert.throws(() => splitForSpeech("。。\n、"));
  const chunks = splitForSpeech("あ".repeat(2_501));
  assert.deepEqual(chunks.map((chunk) => chunk.length), [1000, 1000, 501]);
});
test("Phase 2 prepares valid Podcast JSON while preserving script text", () => {
  const podcast = preparePodcast({ title: "テスト回", sections: [{ text: "これはテストです。二文目です。" }] });
  assert.equal(podcast.segments.map((segment) => segment.text).join(""), "これはテストです。二文目です。");
  assert.ok(podcast.segments.every((segment) => segment.text.length <= 1000));
});
test("speech retries 429 but not 400", async () => {
  const originalKey = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "test";
  const dir = await mkdtemp(path.join(os.tmpdir(), "podcast-test-"));
  try {
    let calls = 0;
    const retryingFetch = async () => { calls++; return calls < 3 ? new Response("busy", { status: 429 }) : new Response(new Uint8Array([1, 2]), { status: 200 }); };
    await synthesizeSpeech({ text: "テスト", voice: "alloy", speed: 1, instructions: "自然", outputPath: path.join(dir, "ok.wav"), fetchImpl: retryingFetch as typeof fetch });
    assert.equal(calls, 3);
    calls = 0;
    await assert.rejects(() => synthesizeSpeech({ text: "テスト", voice: "alloy", speed: 1, instructions: "自然", outputPath: path.join(dir, "bad.wav"), fetchImpl: (async () => { calls++; return new Response("bad", { status: 400 }); }) as typeof fetch }));
    assert.equal(calls, 1);
  } finally { originalKey ? process.env.OPENAI_API_KEY = originalKey : delete process.env.OPENAI_API_KEY; await rm(dir, { recursive: true, force: true }); }
});
test("speech reports a missing API key clearly", async () => {
  const key = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { await assert.rejects(() => synthesizeSpeech({ text: "テスト", voice: "alloy", speed: 1, instructions: "自然", outputPath: "/tmp/unused.wav" }), /OPENAI_API_KEY/); }
  finally { if (key) process.env.OPENAI_API_KEY = key; }
});
