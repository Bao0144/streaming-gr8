#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/videos"

ffmpeg -y \
  -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -t 30 \
  -c:v libx264 -profile:v baseline -pix_fmt yuv420p \
  -an \
  "$ROOT_DIR/videos/sample.mp4"

echo "Created $ROOT_DIR/videos/sample.mp4"
