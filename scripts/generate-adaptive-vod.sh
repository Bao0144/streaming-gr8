#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT_FILE="${1:-$ROOT_DIR/videos/sample.mp4}"
STREAM_KEY="${2:-demo}"
OUTPUT_DIR="$ROOT_DIR/data/hls/$STREAM_KEY"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/*.m3u8 "$OUTPUT_DIR"/*.ts

ffmpeg -y -i "$INPUT_FILE" \
  -filter_complex "\
[0:v]split=3[v1][v2][v3]; \
[v1]scale=w=426:h=240:force_original_aspect_ratio=decrease:force_divisible_by=2[v1out]; \
[v2]scale=w=854:h=480:force_original_aspect_ratio=decrease:force_divisible_by=2[v2out]; \
[v3]scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2[v3out]" \
  -map "[v1out]" -map 0:a:0? \
  -map "[v2out]" -map 0:a:0? \
  -map "[v3out]" -map 0:a:0? \
  -c:v libx264 -preset veryfast -g 48 -sc_threshold 0 \
  -c:a aac -ar 48000 \
  -b:v:0 400k -maxrate:v:0 500k -bufsize:v:0 800k -b:a:0 64k \
  -b:v:1 1000k -maxrate:v:1 1200k -bufsize:v:1 1500k -b:a:1 96k \
  -b:v:2 2500k -maxrate:v:2 2800k -bufsize:v:2 3500k -b:a:2 128k \
  -f hls \
  -hls_time 4 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_filename "$OUTPUT_DIR/%v_segment_%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,name:240p v:1,name:480p v:2,name:720p" \
  "$OUTPUT_DIR/%v.m3u8"

echo "Adaptive HLS generated at: $OUTPUT_DIR/master.m3u8"
