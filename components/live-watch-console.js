"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getHlsBaseUrl } from "components/hls-base-url";
import LiveHlsPlayer from "components/live-hls-player";
import SocialPanel from "components/social-panel";

function buildAdaptiveSource(streamKey, qualityMode) {
  if (!streamKey || qualityMode === "auto") {
    return undefined;
  }

  return `${getHlsBaseUrl()}/hls/${encodeURIComponent(streamKey)}/${qualityMode}.m3u8`;
}

function buildFallbackSource(streamKey) {
  if (!streamKey) {
    return undefined;
  }

  return `${getHlsBaseUrl()}/hls/${encodeURIComponent(streamKey)}/index.m3u8`;
}

export default function LiveWatchConsole({
  streamKey,
  title,
  status
}) {
  const [qualityMode, setQualityMode] = useState("auto");
  const [adaptiveReady, setAdaptiveReady] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [playerMetrics, setPlayerMetrics] = useState({
    resolution: "",
    droppedFrames: null,
    totalFrames: null,
    latency: null,
    bufferHealth: null,
    currentLevel: null,
    levelLabel: null
  });
  const sourcePath = buildAdaptiveSource(streamKey, qualityMode);
  const fallbackPath = buildFallbackSource(streamKey);

  useEffect(() => {
    let cancelled = false;

    async function checkAdaptiveReady() {
      if (!streamKey) {
        setAdaptiveReady(false);
        return;
      }

      try {
        const response = await fetch(`${getHlsBaseUrl()}/hls/${encodeURIComponent(streamKey)}/master.m3u8`, {
          method: "HEAD",
          cache: "no-store"
        });

        if (!cancelled) {
          setAdaptiveReady(response.ok);
        }
      } catch {
        if (!cancelled) {
          setAdaptiveReady(false);
        }
      }
    }

    checkAdaptiveReady();
    const intervalId = window.setInterval(checkAdaptiveReady, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [streamKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchStats() {
      try {
        const response = await fetch("/api/stats", {
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok || cancelled) {
          return;
        }
        setStatsData(payload);
      } catch {
        if (!cancelled) {
          setStatsData(null);
        }
      }
    }

    loadWatchStats();
    const intervalId = window.setInterval(loadWatchStats, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const liveStreamStats = useMemo(() => {
    const applications = statsData?.applications || [];
    for (const application of applications) {
      for (const stream of application.live || []) {
        if (stream.name === streamKey) {
          return stream;
        }
      }
    }
    return null;
  }, [statsData, streamKey]);

  const viewerCount = useMemo(() => {
    if (!liveStreamStats) {
      return 0;
    }

    if (Array.isArray(liveStreamStats.clients) && liveStreamStats.clients.length > 0) {
      return liveStreamStats.clients.filter((client) => !client.publishing).length;
    }

    const rawCount = Number(liveStreamStats.nclients || 0);
    return rawCount > 0 ? Math.max(0, rawCount - 1) : 0;
  }, [liveStreamStats]);

  const metricsChips = [
    {
      label: "Bitrate",
      value: liveStreamStats ? `${liveStreamStats.bandwidthOut || 0} B/s` : "—"
    },
    {
      label: "Resolution",
      value: playerMetrics.resolution || "—"
    },
    {
      label: "FPS",
      value: playerMetrics.totalFrames && playerMetrics.totalFrames > 0 ? "~30" : "—"
    },
    {
      label: "Dropped",
      value: playerMetrics.droppedFrames ?? "—"
    },
    {
      label: "Latency",
      value: typeof playerMetrics.latency === "number" ? `${playerMetrics.latency.toFixed(1)}s` : "—"
    },
    {
      label: "Current quality",
      value: qualityMode === "auto"
        ? (playerMetrics.levelLabel ? `${playerMetrics.levelLabel}p` : "Auto")
        : qualityMode
    },
    {
      label: "Viewer",
      value: String(viewerCount)
    },
    {
      label: "Buffer",
      value: typeof playerMetrics.bufferHealth === "number" ? `${playerMetrics.bufferHealth.toFixed(1)}s` : "—"
    }
  ];

  return (
    <main className="watch-page-shell">
      <section className="watch-console-layout vod-console-frame">
        <div className="watch-main-column">
          <section className="watch-stage">
            <div className="watch-player-region">
              <div className="watch-player-stack">
                <LiveHlsPlayer
                  key={`${streamKey}-${qualityMode}`}
                  streamKey={streamKey}
                  sourcePath={sourcePath}
                  fallbackSourcePath={fallbackPath}
                  preferAdaptive={qualityMode === "auto"}
                  onMetricsChange={setPlayerMetrics}
                  title={title}
                  hideStatus
                />
              </div>
            </div>

            <div className="watch-meta-panel">
              <div className="watch-meta-inline">
                <div className="watch-title-group">
                  <div className="watch-title-row">
                    <span className={`status-pill status-${status}`}>{status === "live" ? "LIVE" : status}</span>
                    <span className={`status-pill ${adaptiveReady ? "status-live" : "status-idle"}`}>
                      {adaptiveReady ? "Adaptive Ready" : "Adaptive Pending"}
                    </span>
                    <h1 className="watch-title">{title}</h1>
                  </div>
                </div>

                <div className="quality-switch watch-quality-switch-inline">
                  {["auto", "240p", "480p", "720p"].map((option) => (
                    <button
                      key={option}
                      className={`quality-btn button-reset${qualityMode === option ? " quality-btn-active" : ""}`}
                      type="button"
                      disabled={option !== "auto" && !adaptiveReady}
                      onClick={() => setQualityMode(option)}
                    >
                      {option === "auto" ? "Auto" : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="watch-metrics-dock">
                <div className="watch-metrics-grid">
                  {metricsChips.map((metric) => (
                    <div className="watch-metric-chip" key={metric.label}>
                      <span className="watch-metric-label">{metric.label}</span>
                      <strong className="watch-metric-value">{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="watch-side-column">
          <div className="watch-sidebar-stack">
            <div className="watch-sidebar-card">
              <div className="watch-sidebar-head">
                <div>
                  <p className="eyebrow">Live chat</p>
                  <h2>Trò chuyện trực tiếp</h2>
                </div>
                <div className="watch-chat-head-meta">
                  <span className={`status-pill status-${status}`}>{status}</span>
                  <span className="watch-chat-viewers">
                    {viewerCount} viewers
                  </span>
                </div>
              </div>
            </div>

            <div className="watch-sidebar-card watch-chat-card">
              <div id="chat-overlay-panel" className="watch-chat-placeholder">
                <SocialPanel
                  contentType="live"
                  contentId={streamKey}
                  compact
                  mode="chat"
                  pollingMs={4000}
                />
              </div>
            </div>

            <div className="watch-sidebar-card">
              <div className="hero-actions watch-sidebar-actions">
                <a className="ghost-btn small-btn" href={fallbackPath}>
                  Mở fallback
                </a>
                <Link className="ghost-btn small-btn" href="/studio">
                  Về Studio
                </Link>
                <Link className="ghost-btn small-btn" href="/stats">
                  Xem thống kê
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
