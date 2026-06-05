"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toAbsoluteHlsUrl } from "components/hls-base-url";

export default function HlsPlayer({
  streamKey,
  compact = false,
  sourcePath,
  fallbackSourcePath,
  title = "HLS Player",
  hideStatus = false,
  fitContainer = false
}) {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hlsRef = useRef(null);
  const fallbackAppliedRef = useRef(false);
  const [status, setStatus] = useState("Đang chờ playlist HLS...");

  const masterPlaylistPath = useMemo(() => {
    if (!streamKey) {
      return null;
    }
    return toAbsoluteHlsUrl(`/hls/${encodeURIComponent(streamKey)}/master.m3u8`);
  }, [streamKey]);

  const fallbackPlaylistPath = useMemo(() => {
    if (fallbackSourcePath) {
      return toAbsoluteHlsUrl(fallbackSourcePath);
    }

    if (!streamKey) {
      return null;
    }
    return toAbsoluteHlsUrl(`/hls/${encodeURIComponent(streamKey)}/index.m3u8`);
  }, [fallbackSourcePath, streamKey]);

  useEffect(() => {
    let disposed = false;

    async function playlistExists(url) {
      if (!url) {
        return false;
      }

      try {
        const response = await fetch(url, {
          method: "HEAD"
        });

        return response.ok;
      } catch {
        return false;
      }
    }

    function toggleFullscreen() {
      const shellElement = shellRef.current;
      if (!shellElement) {
        return;
      }

      try {
        if (document.fullscreenElement === shellElement) {
          document.exitFullscreen?.().catch?.(() => {});
        } else {
          shellElement.requestFullscreen?.().catch?.(() => {});
        }
      } catch {
        setStatus("Không thể chuyển chế độ fullscreen.");
      }
    }

    function handleShellKeydown(event) {
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    async function attachPlayer() {
      const videoElement = videoRef.current;
      const shellElement = shellRef.current;
      if (!videoElement || !shellElement) {
        return;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      fallbackAppliedRef.current = false;

      const playlistPath = await pickPlaylistPath();
      if (!playlistPath) {
        setStatus("Chưa có playlist HLS để phát.");
        return;
      }

      const bindMediaEvents = () => {
        videoElement.onloadedmetadata = () => {
          setStatus(`Đã nạp metadata: ${playlistPath}`);
        };
        videoElement.oncanplay = () => {
          videoElement.play().catch(() => {});
        };
        videoElement.onplaying = () => {
          setStatus(`Đang phát: ${playlistPath}`);
        };
        videoElement.onwaiting = () => {
          setStatus(`Đang đệm dữ liệu: ${playlistPath}`);
        };
        videoElement.onstalled = () => {
          setStatus(`Luồng tạm thời bị stalled: ${playlistPath}`);
        };
      };

      const bindNativeSource = (src) => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        videoElement.src = src;
        videoElement.load();
        videoElement.play().catch(() => {});
      };

      shellElement.tabIndex = 0;
      shellElement.addEventListener("keydown", handleShellKeydown);
      videoElement.addEventListener("dblclick", toggleFullscreen);
      bindMediaEvents();
      setStatus(`Đang tải playlist: ${playlistPath}`);

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        bindNativeSource(playlistPath);
        return;
      }

      try {
        const hlsModule = await import("hls.js");
        const Hls = hlsModule.default;

        if (disposed) {
          return;
        }

        if (!Hls.isSupported()) {
          bindNativeSource(playlistPath);
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });
        hlsRef.current = hls;

        hls.loadSource(playlistPath);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus(`Đã nạp manifest: ${playlistPath}`);
          videoElement.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_LOADED, () => {
          setStatus(`Đang phát: ${playlistPath}`);
        });

        hls.on(Hls.Events.ERROR, async (_, data) => {
          if (!data?.fatal) {
            return;
          }

          if (
            !fallbackAppliedRef.current &&
            fallbackPlaylistPath &&
            fallbackPlaylistPath !== playlistPath &&
            (await playlistExists(fallbackPlaylistPath))
          ) {
            fallbackAppliedRef.current = true;
            setStatus(`Adaptive playlist lỗi, đã chuyển sang fallback: ${fallbackPlaylistPath}`);
            bindNativeSource(fallbackPlaylistPath);
            return;
          }

          setStatus(`Không thể phát playlist: ${playlistPath}`);
        });
      } catch {
        setStatus("Không thể khởi tạo HLS player.");
      }
    }

    async function pickPlaylistPath() {
      if (sourcePath) {
        const primarySourcePath = toAbsoluteHlsUrl(sourcePath);

        if (await playlistExists(primarySourcePath)) {
          return primarySourcePath;
        }

        if (await playlistExists(fallbackPlaylistPath)) {
          return fallbackPlaylistPath;
        }

        return primarySourcePath;
      }

      if (!masterPlaylistPath || !fallbackPlaylistPath) {
        return null;
      }

      if (await playlistExists(masterPlaylistPath)) {
        return masterPlaylistPath;
      }

      return fallbackPlaylistPath;
    }

    attachPlayer();

    return () => {
      disposed = true;

      const shellElement = shellRef.current;
      if (shellElement) {
        shellElement.removeEventListener("keydown", handleShellKeydown);
      }

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.removeEventListener("dblclick", toggleFullscreen);
        videoElement.onloadedmetadata = null;
        videoElement.oncanplay = null;
        videoElement.onplaying = null;
        videoElement.onwaiting = null;
        videoElement.onstalled = null;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [fallbackPlaylistPath, fitContainer, masterPlaylistPath, sourcePath]);

  return (
    <div className={`player-block${compact ? " player-block-compact" : ""}${fitContainer ? " player-block-fit" : ""}`}>
      <div
        ref={shellRef}
        className={`videojs-shell${compact ? " videojs-shell-compact" : ""}${fitContainer ? " videojs-shell-fit" : ""}`}
      >
        <video
          ref={videoRef}
          id={`videojs-${streamKey || "custom"}`}
          className={`video-js vjs-default-skin${compact ? " video-element-compact" : ""}${fitContainer ? " video-element-fit" : ""}`}
          controls
          preload="auto"
          playsInline
          data-setup="{}"
          aria-label={title}
        >
          <p className="vjs-no-js">Trình duyệt của bạn không hỗ trợ phát HLS bằng video tag.</p>
        </video>
      </div>
      {!hideStatus ? <p className="player-status">{status}</p> : null}
    </div>
  );
}
