import { spawn } from "node:child_process";

export async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", (error) => reject(new Error(`FFmpeg could not start: ${error.message}`)));
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-1200)}`)));
  });
}

export async function getDurationSec(filePath: string): Promise<number> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not read a positive MP3 duration.");
  return duration;
}
