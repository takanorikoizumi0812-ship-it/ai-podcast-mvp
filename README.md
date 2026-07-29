# AI Podcast MVP — Phase 1

固定の `sample-podcast.json` を、OpenAI Text-to-Speech API とFFmpegで一つのMP3へ変換します。Phase 2以降の編集チャット・Webフローは未実装です。

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

成功すると `generated/sample-output.mp3` が出力されます。レンダラーは、各セグメントを最大1,000文字・文末単位で分割し、OpenAI Speech APIでMP3化、指定無音を挿入、FFmpegで結合・-16 LUFS正規化します。

## 検証

```bash
npm run typecheck
npm test
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 generated/sample-output.mp3
```

FFmpegとffprobeがPATH上に必要です。音声APIの呼び出しに失敗した場合は、失敗したセグメントで停止し、完成した出力は残しません（セグメント単位の再試行は次フェーズで追加予定です）。
