import { NextResponse } from "next/server";
import { preparePodcast, type PodcastPreparationInput } from "../../../../lib/podcast/prepare";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as PodcastPreparationInput;
    return NextResponse.json({ podcast: preparePodcast(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare podcast JSON.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
