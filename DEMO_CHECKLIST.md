# Demo Checklist - One Page Streaming

Checklist này dùng để demo đúng yêu cầu: mọi thao tác chính nằm trên một dashboard duy nhất.

## 1. Khởi động

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

Mở duy nhất:

```text
http://localhost:3000/
```

## 2. Live streaming từ OBS/camera

1. Trên dashboard, bấm nút `Studio`.
2. Tạo stream key, ví dụ `demo`.
3. Mở OBS.
4. Cấu hình:

```text
Service: Custom
Server: rtmp://localhost:1935/live
Stream Key: demo
```

5. Thêm source camera bằng `Video Capture Device` hoặc màn hình bằng `Display Capture`.
6. Bấm `Start Streaming`.
7. Trên cùng dashboard, bấm `Live`.
8. Chọn stream đang phát và xem player HLS.

## 3. Đổi độ phân giải

Trong khu vực `Live`, bấm các nút:

```text
Auto / 240p / 480p / 720p
```

Nếu adaptive live chưa sẵn sàng, demo adaptive bằng VOD ở bước 5.

## 4. Record livestream

1. Khi OBS đang phát, đợi 10-20 giây.
2. Bấm `Stop Streaming` trong OBS.
3. Trên dashboard, bấm `VOD`.
4. Đồng bộ thư viện và kiểm tra recording vừa sinh ra.

## 5. VOD RTMP/HLS/adaptive

Tạo VOD HLS:

```bash
./scripts/generate-vod-hls.sh videos/sample.mp4 sample
```

Tạo VOD adaptive:

```bash
./scripts/generate-adaptive-vod.sh videos/sample.mp4 sample-adaptive
```

Trên dashboard:

1. Bấm `VOD`.
2. Đồng bộ thư viện.
3. Chọn video.
4. Chuyển giữa `HLS` và `RTMP`.
5. Chọn `Auto`, `240p`, `480p`, `720p` nếu video có adaptive playlist.

RTMP URL để mở bằng VLC:

```text
rtmp://localhost:1935/vod/mp4:sample.mp4
```

## 6. Statistics

Trên dashboard, bấm `Stats`.

Kiểm tra:

- Application RTMP đang chạy.
- Số stream live.
- Số viewer.
- Băng thông vào/ra.

XML gốc nếu cần:

```text
http://localhost:8080/stat
```

## 7. Restream

1. Bấm `Studio`.
2. Nhập YouTube stream key hoặc Facebook stream key.
3. Bấm tạo stream hoặc áp dụng restream target.
4. Publish từ OBS vào RTMP local.
5. Giải thích luồng: OBS -> Nginx live -> HLS local + record + push ra nền tảng ngoài.

## 8. Khi lỗi

Kiểm tra port:

```bash
ss -ltnp | grep -E ':3000|:8080|:1935'
```

Restart Nginx demo:

```bash
./scripts/stop.sh
./scripts/start.sh
```
