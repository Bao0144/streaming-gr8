#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat <<EOF
Run this project in 2 terminals:

Terminal 1:
  cd "$ROOT_DIR"
  ./scripts/start-web.sh

Terminal 2:
  cd "$ROOT_DIR"
  ./scripts/start.sh

Then open:
  Dashboard: http://localhost:3000/
  HLS raw:   http://localhost:8080/hls/<stream-key>/index.m3u8

OBS settings:
  Server:    rtmp://localhost:1935/live
  Stream Key:<stream-key>

Adaptive VOD demo:
  ./scripts/generate-adaptive-vod.sh videos/sample.mp4 sample-adaptive
  Then open dashboard VOD section: http://localhost:3000/#vod
EOF
