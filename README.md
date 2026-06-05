# One Page Streaming Project 3

Project cho môn Công nghệ truyền thông đa phương tiện: xây dựng hệ thống streaming trên Ubuntu với Nginx + nginx-rtmp-module, Next.js, HLS.js, FFmpeg và SQLite.

Điểm chính của bản này: người dùng thao tác trên **một trang web duy nhất** tại `http://localhost:3000/`. Các chức năng Studio, Live, VOD, đổi độ phân giải, Restream, Record và Stats đều là khu vực/nút trong cùng dashboard, không demo theo kiểu mỗi chức năng là một URL riêng.

## Chức năng

- VOD RTMP: phát file trong `videos/` qua `rtmp://localhost:1935/vod/mp4:<file>.mp4`.
- VOD HLS: convert video sang playlist `.m3u8` và phát ngay trên dashboard.
- Live streaming: nhận luồng RTMP từ OBS, webcam hoặc Larix Broadcaster.
- Live HLS: xem livestream trong dashboard bằng HLS.
- Record: ghi lại livestream vào `data/records/`, sau đó đồng bộ vào thư viện VOD.
- Restream: nhập YouTube/Facebook stream key trong Studio, Nginx push luồng ra nền tảng ngoài.
- Adaptive streaming: hỗ trợ Auto/240p/480p/720p cho VOD và live khi có `master.m3u8`.
- Statistics: xem realtime application RTMP, số viewer và băng thông trên cùng dashboard.

## Cấu trúc

- `app/`: Next.js App Router và API nội bộ.
- `components/one-page-dashboard.js`: dashboard một trang.
- `conf/nginx.conf`: template Nginx RTMP/HLS, được render tự động theo thư mục project.
- `scripts/setup-ubuntu.sh`: cài môi trường Ubuntu, build Nginx RTMP, cài npm package và tạo video mẫu.
- `scripts/start-web.sh`: chạy Next.js tại port `3000`.
- `scripts/start.sh`: chạy Nginx RTMP/HLS tại RTMP `1935` và HTTP media `8080`.
- `data/hls/`: HLS live.
- `data/vod/`: HLS VOD và poster.
- `data/records/`: bản ghi livestream.
- `videos/`: video nguồn cho VOD RTMP/HLS.

## Setup Ubuntu

Khuyến nghị Ubuntu 22.04/24.04.

```bash
cd ~/streaming-project-onepage-ubuntu
chmod +x scripts/*.sh
./scripts/setup-ubuntu.sh
```

Script sẽ cài công cụ cần thiết, đảm bảo Node.js >= 18, tải/build Nginx 1.18.0 + nginx-rtmp-module, cài npm packages, tạo `videos/sample.mp4`, generate VOD HLS và adaptive VOD mẫu.

## Chạy project

Terminal 1:

```bash
cd ~/streaming-project-onepage-ubuntu
./scripts/start-web.sh
```

Terminal 2:

```bash
cd ~/streaming-project-onepage-ubuntu
./scripts/start.sh
```

Mở dashboard duy nhất:

```text
http://localhost:3000/
```

Tài khoản demo nằm trên trang login. Đăng nhập xong, dùng các nút Studio, Live, VOD, Stats, Demo trong cùng trang để thao tác.

## OBS / Camera

Trong dashboard, vào khu vực Studio và tạo stream key.

OBS:

```text
Service: Custom
Server: rtmp://localhost:1935/live
Stream Key: key tạo trên dashboard
```

Để demo camera, thêm source `Video Capture Device`. Để demo màn hình, thêm `Display Capture` hoặc `Window Capture`.

Larix Broadcaster trên điện thoại:

```text
Server URL: rtmp://YOUR_UBUNTU_IP:1935/live
Stream name: key tạo trên dashboard
```

Nếu publish từ máy khác trong LAN, đổi policy:

```bash
cp conf/publish.policy.public.conf conf/publish.policy.conf
./scripts/stop.sh
./scripts/start.sh
```

## VOD

Tạo HLS VOD từ file bất kỳ:

```bash
./scripts/generate-vod-hls.sh videos/sample.mp4 sample
```

Tạo adaptive VOD:

```bash
./scripts/generate-adaptive-vod.sh videos/sample.mp4 sample-adaptive
```

Sau đó vào khu vực VOD trên dashboard, bấm đồng bộ thư viện và chọn video. Có thể chuyển giữa HLS/RTMP và Auto/240p/480p/720p ngay trong trang.

## Restream

Trong Studio:

1. Nhập YouTube stream key hoặc Facebook stream key.
2. Bấm tạo stream hoặc áp dụng restream target.
3. Bắt đầu publish từ OBS vào `rtmp://localhost:1935/live`.
4. Nginx nhận luồng local, tạo HLS local, record và push tiếp ra target ngoài.

## Kiểm tra nhanh

```bash
ss -ltnp | grep -E ':3000|:8080|:1935'
curl -I http://127.0.0.1:8080/vod/sample/index.m3u8
curl -I http://127.0.0.1:8080/vod/sample-adaptive/master.m3u8
```

Nếu Nginx đang chạy cũ:

```bash
./scripts/stop.sh
./scripts/start.sh
```
