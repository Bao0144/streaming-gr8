#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_BIN="$ROOT_DIR/src/nginx-1.18.0/objs/nginx"
CONF_TEMPLATE="$ROOT_DIR/conf/nginx.conf"
CONF_FILE="$ROOT_DIR/run/nginx.conf"
PID_FILE="$ROOT_DIR/run/nginx.pid"

mkdir -p "$ROOT_DIR/logs" "$ROOT_DIR/run" "$ROOT_DIR/data/hls" "$ROOT_DIR/data/vod" "$ROOT_DIR/data/records"

ESCAPED_ROOT_DIR="${ROOT_DIR//&/\\&}"
sed "s#__PROJECT_ROOT__#$ESCAPED_ROOT_DIR#g" "$CONF_TEMPLATE" > "$CONF_FILE"

if [[ -f "$PID_FILE" ]]; then
  PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$PID" ]] && ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Removed stale nginx pid file: $PID_FILE"
  fi
fi

"$NGINX_BIN" -t -p "$ROOT_DIR/" -c "$CONF_FILE"
"$NGINX_BIN" -p "$ROOT_DIR/" -c "$CONF_FILE"

echo "Nginx started."
echo "Player URL: http://localhost:8080/"
echo "Publish URL: rtmp://localhost:1935/live/<stream-key>"
