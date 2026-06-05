from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 980
BG = "white"
BOX = "#edf4ff"
BOX_WHITE = "#ffffff"
STROKE = "#222222"
TEXT = "#111111"


def load_font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


TITLE_FONT = load_font(34, bold=True)
LABEL_FONT = load_font(18, bold=True)
SMALL_FONT = load_font(16, bold=True)


def center_text(draw, box, text, font, fill=TEXT, line_gap=6):
    x1, y1, x2, y2 = box
    lines = text.split("\n")
    bboxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    widths = [b[2] - b[0] for b in bboxes]
    heights = [b[3] - b[1] for b in bboxes]
    total_h = sum(heights) + line_gap * (len(lines) - 1)
    y = y1 + (y2 - y1 - total_h) / 2
    for line, w, h in zip(lines, widths, heights):
      x = x1 + (x2 - x1 - w) / 2
      draw.text((x, y), line, font=font, fill=fill)
      y += h + line_gap


def box(draw, rect, text, fill=BOX, font=LABEL_FONT):
    draw.rounded_rectangle(rect, radius=14, outline=STROKE, width=2, fill=fill)
    center_text(draw, rect, text, font)


def arrow(draw, pts, width=3):
    draw.line(pts, fill=STROKE, width=width)
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 12
    left = (
        x2 - size * math.cos(ang) + size * 0.6 * math.sin(ang),
        y2 - size * math.sin(ang) - size * 0.6 * math.cos(ang),
    )
    right = (
        x2 - size * math.cos(ang) - size * 0.6 * math.sin(ang),
        y2 - size * math.sin(ang) + size * 0.6 * math.cos(ang),
    )
    draw.polygon([(x2, y2), left, right], fill=STROKE)


def bidir_arrow(draw, start, end, width=3):
    arrow(draw, [start, end], width=width)
    arrow(draw, [end, start], width=width)


img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

title = "SƠ ĐỒ KIẾN TRÚC HỆ THỐNG STREAMING"
tb = draw.textbbox((0, 0), title, font=TITLE_FONT)
draw.text(((W - (tb[2] - tb[0])) / 2, 24), title, font=TITLE_FONT, fill=TEXT)

web = (80, 350, 380, 450)
studio = (30, 560, 150, 644)
stats = (170, 560, 290, 644)
login = (310, 560, 440, 644)

source = (600, 110, 1000, 210)
obs = (610, 260, 990, 352)
nginx = (560, 430, 1040, 540)
live_hls = (520, 650, 720, 746)
recording = (780, 650, 980, 746)
restream = (1040, 650, 1240, 746)
watch = (520, 830, 720, 926)
vod = (780, 830, 980, 926)
sqlite = (1220, 350, 1440, 450)
yt = (1180, 830, 1360, 926)
fb = (1380, 830, 1560, 926)

box(draw, web, "Web App / Next.js")
box(draw, studio, "Studio", fill=BOX_WHITE, font=SMALL_FONT)
box(draw, stats, "Stats", fill=BOX_WHITE, font=SMALL_FONT)
box(draw, login, "Đăng nhập", fill=BOX_WHITE, font=SMALL_FONT)
box(draw, source, "Nguồn phát\n(Camera / Màn hình / Micro)", fill=BOX_WHITE, font=LABEL_FONT)
box(draw, obs, "OBS / Software Encoder", fill=BOX_WHITE, font=LABEL_FONT)
box(draw, nginx, "Nginx RTMP Media Server", fill=BOX)
box(draw, live_hls, "Live HLS", fill=BOX_WHITE)
box(draw, recording, "Recording", fill=BOX_WHITE)
box(draw, restream, "Restream", fill=BOX_WHITE)
box(draw, watch, "Trang Watch", fill=BOX)
box(draw, vod, "Thư viện VOD", fill=BOX)
box(draw, sqlite, "SQLite", fill=BOX)
box(draw, yt, "YouTube Live", fill=BOX_WHITE, font=SMALL_FONT)
box(draw, fb, "Facebook Live", fill=BOX_WHITE, font=SMALL_FONT)

# Main vertical
arrow(draw, [(800, 210), (800, 260)])
arrow(draw, [(800, 352), (800, 430)])

# Branches
arrow(draw, [(620, 540), (620, 650)])
arrow(draw, [(880, 540), (880, 650)])
arrow(draw, [(1140, 540), (1140, 650)])
arrow(draw, [(620, 746), (620, 830)])
arrow(draw, [(880, 746), (880, 830)])
arrow(draw, [(1140, 746), (1140, 790), (1270, 790), (1270, 830)])
arrow(draw, [(1140, 746), (1140, 790), (1470, 790), (1470, 830)])

# App connections
bidir_arrow(draw, (380, 400), (560, 400))
bidir_arrow(draw, (380, 370), (1220, 370))
arrow(draw, [(90, 560), (90, 505), (230, 505), (230, 450)])
arrow(draw, [(230, 560), (230, 450)])
arrow(draw, [(375, 560), (375, 505), (230, 505), (230, 450)])
arrow(draw, [(260, 450), (260, 785), (620, 785), (620, 830)])
arrow(draw, [(340, 450), (340, 805), (880, 805), (880, 830)])

img.save("assets/streaming-architecture-diagram-clean.png")
print("saved assets/streaming-architecture-diagram-clean.png")
