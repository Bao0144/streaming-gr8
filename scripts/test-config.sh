#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_BIN="$ROOT_DIR/src/nginx-1.18.0/objs/nginx"
CONF_TEMPLATE="$ROOT_DIR/conf/nginx.conf"
CONF_FILE="$ROOT_DIR/run/nginx.conf"

mkdir -p "$ROOT_DIR/logs" "$ROOT_DIR/run" "$ROOT_DIR/data/hls" "$ROOT_DIR/data/vod" "$ROOT_DIR/data/records"

ESCAPED_ROOT_DIR="${ROOT_DIR//&/\\&}"
sed "s#__PROJECT_ROOT__#$ESCAPED_ROOT_DIR#g" "$CONF_TEMPLATE" > "$CONF_FILE"

"$NGINX_BIN" -t -p "$ROOT_DIR/" -c "$CONF_FILE"
