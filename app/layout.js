import "./globals.css";
import "video.js/dist/video-js.css";
import GlobalTopBar from "components/global-topbar";

export const metadata = {
  title: "Hệ thống Streaming",
  description: "Ubuntu RTMP/HLS streaming control dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <GlobalTopBar />
        {children}
      </body>
    </html>
  );
}
