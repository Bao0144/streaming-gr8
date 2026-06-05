#!/usr/bin/env bash
set -euo pipefail

# Tạo VOD HLS đóng gói từ một file media local.
# Cấu trúc output:
#   data/vod/<output-name>/master.m3u8
#   data/vod/<output-name>/240p.m3u8, 480p.m3u8, 720p.m3u8
#   data/vod/<output-name>/*_segment_000.ts ...
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT_FILE="${1:-$ROOT_DIR/videos/sample.mp4}"
OUTPUT_NAME="${2:-sample}"
OUTPUT_DIR="$ROOT_DIR/data/vod/$OUTPUT_NAME"

# Xóa output cũ để tránh playlist/segment cũ còn sót lại.
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Đọc chiều cao nguồn để chỉ tạo các variant hợp lý.
SOURCE_HEIGHT="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$INPUT_FILE" | tr -d '\r')"
if [[ -z "${SOURCE_HEIGHT:-}" ]]; then
  echo "Cannot detect source height for $INPUT_FILE" >&2
  exit 1
fi

# Audio là tùy chọn. Nếu có, nó sẽ được chép vào từng variant HLS.
HAS_AUDIO="0"
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$INPUT_FILE" >/dev/null 2>&1; then
  HAS_AUDIO="1"
fi

declare -a VARIANT_LABELS=()
declare -a VARIANT_HEIGHTS=()
declare -a VARIANT_WIDTHS=()
declare -a VARIANT_VIDEO_BITRATES=()
declare -a VARIANT_MAXRATES=()
declare -a VARIANT_BUFSIZES=()

add_variant() {
  VARIANT_LABELS+=("$1")
  VARIANT_HEIGHTS+=("$2")
  VARIANT_WIDTHS+=("$3")
  VARIANT_VIDEO_BITRATES+=("$4")
  VARIANT_MAXRATES+=("$5")
  VARIANT_BUFSIZES+=("$6")
}

# Tạo ladder adaptive đơn giản dựa trên chiều cao nguồn.
# Không upscale quá mức cần thiết so với source thực tế.
if (( SOURCE_HEIGHT >= 720 )); then
  add_variant "240p" 240 426 400k 500k 800k
  add_variant "480p" 480 854 1000k 1200k 1500k
  add_variant "720p" 720 1280 2500k 2800k 3500k
elif (( SOURCE_HEIGHT >= 480 )); then
  add_variant "240p" 240 426 400k 500k 800k
  add_variant "480p" 480 854 1000k 1200k 1500k
else
  add_variant "240p" 240 426 400k 500k 800k
fi

VARIANT_COUNT="${#VARIANT_LABELS[@]}"
if (( VARIANT_COUNT == 0 )); then
  echo "No valid VOD variants configured for $INPUT_FILE" >&2
  exit 1
fi

# Tách luồng video đã decode thành N nhánh, mỗi nhánh ứng với một variant output.
declare -a FILTER_PARTS=()
SPLIT_TARGETS=""
for (( i=0; i<VARIANT_COUNT; i++ )); do
  SPLIT_TARGETS+="[v${i}]"
done
FILTER_PARTS+=("[0:v]split=${VARIANT_COUNT}${SPLIT_TARGETS}")

# Scale từng nhánh về đúng resolution đích nhưng vẫn giữ aspect ratio.
# Pad được dùng để đảm bảo output có canvas cố định và kích thước chia hết hợp lệ.
for (( i=0; i<VARIANT_COUNT; i++ )); do
  label="${VARIANT_LABELS[$i]}"
  height="${VARIANT_HEIGHTS[$i]}"
  width="${VARIANT_WIDTHS[$i]}"
  FILTER_PARTS+=("[v${i}]scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black[${label}]")
done

FILTER_COMPLEX="$(IFS=';'; echo "${FILTER_PARTS[*]}")"

declare -a CMD=(
  ffmpeg
  -v error
  -nostats
  -y
  -i "$INPUT_FILE"
  -filter_complex "$FILTER_COMPLEX"
)

MAPS=()
for (( i=0; i<VARIANT_COUNT; i++ )); do
  label="${VARIANT_LABELS[$i]}"
  vb="${VARIANT_VIDEO_BITRATES[$i]}"
  maxrate="${VARIANT_MAXRATES[$i]}"
  bufsize="${VARIANT_BUFSIZES[$i]}"

  # Encode từng nhánh sang H.264 Main với bitrate cap phù hợp cho adaptive HLS.
  CMD+=(
    -map "[${label}]"
    -c:v:${i} libx264
    -preset veryfast
    -profile:v:${i} main
    -crf 23
    -sc_threshold:v:${i} 0
    -g:v:${i} 48
    -keyint_min:v:${i} 48
    -b:v:${i} "$vb"
    -maxrate:v:${i} "$maxrate"
    -bufsize:v:${i} "$bufsize"
  )

  if [[ "$HAS_AUDIO" == "1" ]]; then
    CMD+=(
      -map 0:a:0
      -c:a:${i} aac
      -b:a:${i} 128k
      -ac:a:${i} 2
      -ar:a:${i} 48000
    )
    MAPS+=("v:${i},a:${i},name:${label}")
  else
    MAPS+=("v:${i},name:${label}")
  fi
done

VAR_STREAM_MAP="$(IFS=' '; echo "${MAPS[*]}")"

# Xuất ra các playlist variant và một master playlist tổng.
CMD+=(
  -f hls
  -hls_time 4
  -hls_playlist_type vod
  -hls_flags independent_segments
  -master_pl_name master.m3u8
  -var_stream_map "$VAR_STREAM_MAP"
  -hls_segment_filename "$OUTPUT_DIR/%v_segment_%03d.ts"
  "$OUTPUT_DIR/%v.m3u8"
)

"${CMD[@]}"

# Tạo một playlist fallback ổn định cho web UI.
# Ở đây copy variant cao nhất thành index.m3u8.
BEST_VARIANT="${VARIANT_LABELS[$((VARIANT_COUNT - 1))]}"
cp "$OUTPUT_DIR/${BEST_VARIANT}.m3u8" "$OUTPUT_DIR/index.m3u8"

echo "Adaptive VOD HLS generated at: $OUTPUT_DIR/master.m3u8"
