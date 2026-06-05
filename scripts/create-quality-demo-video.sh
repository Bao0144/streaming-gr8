#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/videos"

ffmpeg -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=30,drawgrid=width=80:height=80:thickness=2:color=white@0.35,drawbox=x=mod(t*180\\,1180):y=90:w=100:h=100:color=red@0.75:t=fill,drawbox=x=1180-mod(t*160\\,1180):y=520:w=100:h=100:color=lime@0.75:t=fill" \
  -t 45 \
  -c:v libx264 \
  -preset veryfast \
  -profile:v baseline \
  -pix_fmt yuv420p \
  -an \
  "$ROOT_DIR/videos/quality-demo.mp4"

echo "Created $ROOT_DIR/videos/quality-demo.mp4"
echo "Generate VOD HLS with:"
echo "  $ROOT_DIR/scripts/generate-vod-hls.sh $ROOT_DIR/videos/quality-demo.mp4 quality-demo"
