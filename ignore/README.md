# Ignore Notes

Thư mục này ghi chú các nhóm file không nên đẩy lên GitHub khi nộp source code.

Các nhóm file đang được ignore trong `.gitignore`:

- Build output: `.next/`
- Dependencies: `node_modules/`
- Runtime media/logs: `logs/`, `run/`, `data/hls/`, `data/records/`, `data/vod/`
- Temp của Nginx: `client_body_temp/`, `fastcgi_temp/`, `proxy_temp/`, `scgi_temp/`, `uwsgi_temp/`
- File môi trường/secrets: `.env*`
- Cơ sở dữ liệu local và file tạm: `*.sqlite`, `*.db`, `*.pid`, `*.log`
- Media demo lớn và file quay màn hình local: `videos/`, `facebook.mp4`, `youtube.mp4`, `video.mp4`
- File báo cáo cá nhân và ảnh chụp màn hình: `report.docx`, `report.pdf`, `Screenshot *.png`
- Windows metadata: `*:Zone.Identifier`

Nên đưa lên GitHub:

- Source code: `app/`, `components/`, `lib/`, `scripts/`
- Config: `conf/`, `next.config.js`, `jsconfig.json`, `package.json`, `package-lock.json`
- Tài liệu demo: `README.md`, `DEMO_CHECKLIST.md`
- Source build của Nginx/RTMP nếu muốn giảng viên xem cách biên dịch: `src/`

Gợi ý: tạo repo riêng cho `streaming-project-onepage-ubuntu` để tránh đẩy nhầm source của nhóm tham khảo.
