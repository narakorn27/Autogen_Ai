# GhostAI STT Connector PHP

PHP connector for `ghostai-studio-react` that keeps the frontend talking to a stable REST contract while production transcription runs through Google Cloud Speech-to-Text.

## What This Package Does

- Accepts YouTube URLs or uploaded audio/video files
- Uses `yt-dlp` plus `ffmpeg` to prepare audio for Speech-to-Text
- Calls Google Cloud Speech-to-Text as the production-first provider
- Supports two modes:
  - `managed_google`
  - `byo_google`
- Returns transcript text, segments, source metadata, and warnings as JSON

## API Endpoints

- `GET /api/health.php`
- `GET /api/providers.php`
- `POST /api/transcribe_youtube.php`
- `POST /api/transcribe_upload.php`
- `POST /api/extract_youtube_audio.php`

## Host Capability Checklist

Production hosting should pass all of these:

- PHP with cURL enabled
- Writable `storage/` directories
- File upload support
- `exec()` enabled
- `ffmpeg` available to the PHP process
- `yt-dlp` available if YouTube extraction is needed

If the host does not allow `exec()` or cannot access `ffmpeg`, only limited upload handling will work and YouTube ingestion will fail.

## Configuration

Configure with environment variables:

- `GHOSTAI_ALLOWED_ORIGIN`
- `GHOSTAI_GOOGLE_STT_API_KEY`
- `GHOSTAI_FFMPEG_BINARY`
- `GHOSTAI_YTDLP_BINARY`
- `GHOSTAI_MAX_UPLOAD_BYTES`

Suggested defaults:

- `GHOSTAI_ALLOWED_ORIGIN=*`
- `GHOSTAI_FFMPEG_BINARY=ffmpeg`
- `GHOSTAI_YTDLP_BINARY=yt-dlp`
- `GHOSTAI_MAX_UPLOAD_BYTES=314572800`

## Shared Hosting Notes

- Shared hosting is viable only if it supports PHP file uploads plus shell execution of external binaries.
- If `yt-dlp` is blocked, keep the upload path enabled and treat it as the production fallback.
- The frontend can move to Vercel later without changing this API contract.

## Future Migration Path

The frontend is intentionally written against a REST contract, not PHP-specific behavior.

When a VPS is available, this connector can be replaced by a TypeScript backend as long as these stay stable:

- Endpoint paths
- Request fields
- Response schema

## Storage Layout

- `storage/uploads/` uploaded source files
- `storage/temp_audio/` prepared audio and extracted mp3
- `storage/transcripts/` saved transcript JSON for inspection
- `storage/logs/` optional connector logs
