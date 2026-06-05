"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toAbsoluteHlsUrl } from "components/hls-base-url";

export default function LiveHlsPlayer({
  streamKey,
  sourcePath,
  fallbackSourcePath,
  preferAdaptive = true,
  onMetricsChange,
  title = "Live HLS Player",
  hideStatus = false
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState("Đang chờ playlist live HLS...");
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
    let metricsIntervalId = null;

    function emitMetrics(hls) {
      const video = videoRef.current;
      if (!video || !onMetricsChange) {
        return;
      }

      const playbackQuality = typeof video.getVideoPlaybackQuality === "function"
        ? video.getVideoPlaybackQuality()
        : null;

      const bufferHealth = (() => {
        try {
          if (!video.buffered || video.buffered.length === 0) {
            return null;
          }
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          return Math.max(0, bufferedEnd - video.currentTime);
        } catch {
          return null;
        }
      })();

      onMetricsChange({
        resolution: video.videoWidth && video.videoHeight
          ? `${video.videoWidth}x${video.videoHeight}`
          : "",
        droppedFrames: playbackQuality?.droppedVideoFrames ?? null,
        totalFrames: playbackQuality?.totalVideoFrames ?? null,
        latency: hls?.latency ?? null,
        bufferHealth,
        currentLevel: hls && hls.currentLevel >= 0 ? hls.currentLevel : null,
        levelLabel: hls && hls.currentLevel >= 0 ? hls.levels?.[hls.currentLevel]?.height : null
      });
    }

    async function playlistExists(url) {
      if (!url) {
        return false;
      }

      try {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok;
      } catch {
        return false;
      }
    }

    async function attachPlayer() {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      let playlistPath = toAbsoluteHlsUrl(sourcePath) || fallbackPlaylistPath;
      if (!sourcePath && preferAdaptive && (await playlistExists(masterPlaylistPath))) {
        playlistPath = masterPlaylistPath;
      }

      if (!playlistPath) {
        setStatus("Chưa có playlist HLS để phát.");
        return;
      }

      const cleanupHls = () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (metricsIntervalId) {
          window.clearInterval(metricsIntervalId);
          metricsIntervalId = null;
        }
      };

      const bindNativeSource = (src) => {
        cleanupHls();
        video.src = src;
        video.load();
      };

      setStatus(`Đang tải playlist: ${playlistPath}`);

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        bindNativeSource(playlistPath);
        metricsIntervalId = window.setInterval(() => emitMetrics(null), 1500);
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
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus(`Đã nạp manifest: ${playlistPath}`);
          emitMetrics(hls);
        });

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          emitMetrics(hls);
        });

        hls.on(Hls.Events.LEVEL_LOADED, () => {
          setStatus(`Đang phát: ${playlistPath}`);
          emitMetrics(hls);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          emitMetrics(hls);
        });

        metricsIntervalId = window.setInterval(() => emitMetrics(hls), 1500);

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data?.fatal) {
            return;
          }

          if (fallbackPlaylistPath && fallbackPlaylistPath !== playlistPath) {
            setStatus(`Adaptive playlist lỗi, chuyển sang fallback: ${fallbackPlaylistPath}`);
            bindNativeSource(fallbackPlaylistPath);
            return;
          }

          setStatus(`Không thể phát playlist: ${playlistPath}`);
        });
      } catch {
        bindNativeSource(playlistPath);
        metricsIntervalId = window.setInterval(() => emitMetrics(null), 1500);
      }
    }

    attachPlayer();

    return () => {
      disposed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (metricsIntervalId) {
        window.clearInterval(metricsIntervalId);
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [fallbackPlaylistPath, masterPlaylistPath, onMetricsChange, preferAdaptive, sourcePath]);

  return (
    <div className="player-block player-block-live-direct">
      <div className="live-video-shell">
        <video
          ref={videoRef}
          className="live-video-element"
          controls
          muted
          playsInline
          preload="auto"
          aria-label={title}
        />
      </div>
      {!hideStatus ? <p className="player-status">{status}</p> : null}
    </div>
  );
}
