#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
NGINX_VERSION="1.18.0"
OPENSSL_VERSION="1.1.1s"

sudo apt update
sudo apt install -y \
  build-essential \
  ca-certificates \
  curl \
  ffmpeg \
  git \
  libpcre3 \
  libpcre3-dev \
  libssl-dev \
  net-tools \
  wget \
  zlib1g \
  zlib1g-dev

NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ -z "$NODE_MAJOR" || "$NODE_MAJOR" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

mkdir -p "$SRC_DIR" "$ROOT_DIR/data/hls" "$ROOT_DIR/data/vod" "$ROOT_DIR/data/records" "$ROOT_DIR/videos" "$ROOT_DIR/logs" "$ROOT_DIR/run"

cd "$SRC_DIR"

if [[ ! -d "nginx-$NGINX_VERSION" ]]; then
  wget -O "nginx-$NGINX_VERSION.tar.gz" "https://nginx.org/download/nginx-$NGINX_VERSION.tar.gz"
  tar -xzf "nginx-$NGINX_VERSION.tar.gz"
fi

if [[ ! -d "openssl-$OPENSSL_VERSION" ]]; then
  wget -O "openssl-$OPENSSL_VERSION.tar.gz" "https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz"
  tar -xzf "openssl-$OPENSSL_VERSION.tar.gz"
fi

if [[ ! -d "nginx-rtmp-module" ]]; then
  git clone https://github.com/arut/nginx-rtmp-module.git
fi

cd "$SRC_DIR/nginx-$NGINX_VERSION"

./configure \
  --prefix="$ROOT_DIR/runtime/nginx" \
  --with-http_ssl_module \
  --with-http_stub_status_module \
  --with-http_flv_module \
  --with-http_mp4_module \
  --with-threads \
  --with-openssl="$SRC_DIR/openssl-$OPENSSL_VERSION" \
  --add-module="$SRC_DIR/nginx-rtmp-module"

make -j"$(nproc)"

cd "$ROOT_DIR"
npm install

if [[ ! -f "$ROOT_DIR/videos/sample.mp4" ]]; then
  ffmpeg -y \
    -f lavfi -i testsrc=size=1280x720:rate=30 \
    -f lavfi -i sine=frequency=1000:sample_rate=44100 \
    -t 30 \
    -c:v libx264 -profile:v baseline -pix_fmt yuv420p \
    -c:a aac -shortest \
    "$ROOT_DIR/videos/sample.mp4"
fi

"$ROOT_DIR/scripts/generate-vod-hls.sh" "$ROOT_DIR/videos/sample.mp4" sample
"$ROOT_DIR/scripts/generate-adaptive-vod.sh" "$ROOT_DIR/videos/sample.mp4" sample-adaptive

cat <<EOF

Setup xong.

Chay web:
  cd "$ROOT_DIR"
  ./scripts/start-web.sh

Chay Nginx RTMP/HLS:
  cd "$ROOT_DIR"
  ./scripts/start.sh

Mo dashboard duy nhat:
  http://localhost:3000/

OBS:
  Server: rtmp://localhost:1935/live
  Stream Key: tao tren dashboard
EOF
