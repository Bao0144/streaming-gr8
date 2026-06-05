#!/usr/bin/env bash
set -euo pipefail

# Chuẩn hóa một video local thành MP4 thân thiện với RTMP:
# - H.264 Main
# - yuv420p
# - AAC LC stereo 48kHz
# Việc này cần thiết vì RTMP VOD playback thường khắt khe hơn HLS playback.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <input-video> [output-name]" >&2
  exit 1
fi

INPUT_PATH="$1"
OUTPUT_NAME="${2:-}"

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Input file not found: $INPUT_PATH" >&2
  exit 1
fi

INPUT_BASENAME="$(basename "$INPUT_PATH")"
INPUT_STEM="${INPUT_BASENAME%.*}"
OUTPUT_STEM="${OUTPUT_NAME:-$INPUT_STEM-rtmp}"
OUTPUT_PATH="$ROOT_DIR/videos/${OUTPUT_STEM}.mp4"

# Re-encode về profile tương thích an toàn cho VLC + nginx-rtmp VOD.
ffmpeg \
  -v error \
  -nostats \
  -y \
  -i "$INPUT_PATH" \
  -map 0:v:0 \
  -map 0:a:0? \
  -c:v libx264 \
  -preset veryfast \
  -profile:v main \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac \
  -b:a 128k \
  -ar 48000 \
  -ac 2 \
  "$OUTPUT_PATH"

echo "Normalized RTMP VOD written to: $OUTPUT_PATH"
echo "RTMP URL: rtmp://localhost:1935/vod/mp4:$(basename "$OUTPUT_PATH")"
