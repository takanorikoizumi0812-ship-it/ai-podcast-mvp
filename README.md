# AI Podcast MVP — Phase 1

固定の `sample-podcast.json` を、OpenAI Text-to-Speech API とFFmpegで一つのMP3へ変換します。Phase 2として、任意の台本を規定Podcast JSONへ変換するAPIも実装済みです。編集チャット・構成／台本生成UIは未実装です。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に OPENAI_API_KEY を設定
```

`OPENAI_API_KEY` はサーバー／CLI環境だけで読み取り、ブラウザ側のコードには渡しません。

## 実行

```bash
set -a; source .env.local; set +a
npm run render:sample
```

成功すると `generated/sample-output.mp3` が出力されます。レンダラーは、各セグメントを最大1,000文字・文末単位で分割し、OpenAI Speech APIでWAV化、指定無音をWAVで挿入、FFmpegで結合・-16 LUFS正規化後に一度だけMP3化します。TTSは45秒タイムアウト、最大3回の指数バックオフ再試行、セグメント単位のWAVキャッシュを備えます。

## Phase 2: 台本からPodcast JSON

`POST /api/podcast/prepare` に以下のJSONを送ると、読み上げ文を変えずに、1,000文字以下のセグメントへ分割したPodcast JSONを返します。

```json
{
  "title": "テスト回",
  "sections": [{ "type": "hook", "text": "これはテストです。二文目です。" }]
}
```

Schemaは有効な音声enum（`marin`・`cedar`を含む）、一意なセグメントID、読み上げ可能な本文、0〜30秒の無音、最大100セグメントを実行時に検証します。

## 検証

```bash
npm run typecheck
npm test
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 generated/sample-output.mp3
```

FFmpegとffprobeがPATH上に必要です。音声APIの呼び出しに失敗した場合は、失敗したセグメントで停止し、完成した出力は残しません（セグメント単位の再試行は次フェーズで追加予定です）。
