"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HlsPlayer from "components/hls-player";
import {
  BroadcastIcon,
  CameraIcon,
  PlayIcon,
  PulseIcon,
  StorageIcon
} from "components/system-icons";

function formatBitrate(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 kbps";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} Mbps`;
  }

  return `${Math.round(value)} kbps`;
}

function formatCount(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function AppShell() {
  const [streams, setStreams] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [statsOnline, setStatsOnline] = useState(false);
  const [watchQuery, setWatchQuery] = useState("");
  const [showWatchFinder, setShowWatchFinder] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [streamsResponse, statsResponse, recordingsResponse] = await Promise.all([
          fetch("/api/streams", { cache: "no-store" }),
          fetch("/api/stats", { cache: "no-store" }),
          fetch("/api/recordings", { cache: "no-store" })
        ]);

        const [streamsData, statsData, recordingsData] = await Promise.all([
          streamsResponse.json().catch(() => ({})),
          statsResponse.json().catch(() => ({})),
          recordingsResponse.json().catch(() => ({}))
        ]);

        if (!mounted) {
          return;
        }

        setStreams(streamsResponse.ok ? streamsData.streams || [] : []);
        setAvailableRooms(streamsResponse.ok ? streamsData.availableRooms || [] : []);
        setStats(statsResponse.ok ? statsData : null);
        setStatsOnline(statsResponse.ok);
        setRecordings(recordingsResponse.ok ? recordingsData.recordings || [] : []);
      } catch {
        if (!mounted) {
          return;
        }

        setStreams([]);
        setAvailableRooms([]);
        setStats(null);
        setStatsOnline(false);
        setRecordings([]);
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 5000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const liveStream = useMemo(
    () => availableRooms[0] || null,
    [availableRooms]
  );

  const recentStreams = useMemo(() => streams.slice(0, 5), [streams]);
  const availableWatchStreams = useMemo(() => {
    const normalized = watchQuery.trim().toLowerCase();

    if (!normalized) {
      return availableRooms;
    }

    return availableRooms.filter((stream) =>
      `${stream.title} ${stream.watchSlug || ""} ${stream.streamKey}`.toLowerCase().includes(normalized)
    );
  }, [availableRooms, watchQuery]);

  const summary = stats?.summary || {
    totalLiveStreams: liveStream ? 1 : 0,
    totalClients: 0,
    totalInboundBandwidth: 0,
    totalApplications: 0
  };

  const heroMetrics = [
    {
      label: "Live streams",
      value: formatCount(summary.totalLiveStreams),
      tone: "accent"
    },
    {
      label: "Active viewers",
      value: formatCount(summary.totalClients),
      tone: "neutral"
    },
    {
      label: "Recordings",
      value: formatCount(recordings.length),
      tone: "neutral"
    },
    {
      label: "Bitrate",
      value: formatBitrate(summary.totalInboundBandwidth),
      tone: "neutral"
    }
  ];

  const liveMetrics = [
    {
      label: "Applications",
      value: formatCount(summary.totalApplications)
    },
    {
      label: "Inbound",
      value: formatBitrate(summary.totalInboundBandwidth)
    },
    {
      label: "Viewers",
      value: formatCount(summary.totalClients)
    },
    {
      label: "Recordings",
      value: formatCount(recordings.length)
    }
  ];

  const featureCards = [
    {
      href: "/studio",
      title: "Studio",
      description: "Tạo stream key, điều phối ingest và áp dụng restream target.",
      meta: "Production control",
      Icon: BroadcastIcon
    },
    {
      href: "/vod",
      title: "Media Library",
      description: "Quản lý thư viện VOD, queue phát và workflow HLS / RTMP.",
      meta: "On-demand playback",
      Icon: StorageIcon
    },
    {
      href: "/vod",
      title: "Recordings",
      description: "Truy cập bản ghi MP4 đã hoàn tất ngay trong media library.",
      meta: "Archive & review",
      Icon: CameraIcon
    },
    {
      href: "/stats",
      title: "Analytics",
      description: "Theo dõi application RTMP, viewer realtime và băng thông.",
      meta: "Realtime telemetry",
      Icon: PulseIcon
    },
    {
      href: liveStream ? liveStream.watchPath : "/studio",
      title: "Live Watch",
      description: "Giám sát playback HLS, adaptive state và chất lượng stream.",
      meta: "Operator preview",
      Icon: PlayIcon
    },
    {
      href: "/stats",
      title: "System health",
      description: "Theo dõi health của stats endpoint, viewer sessions và băng thông đầu vào.",
      meta: "Operations health",
      Icon: PulseIcon
    }
  ];

  function handleWatchFinderSubmit(event) {
    event.preventDefault();
    setShowWatchFinder(true);
  }

  return (
    <main className="page-shell dashboard-shell">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="section-kicker">Streaming control</p>
          <h1 className="dashboard-title">Streaming Project</h1>
          <div className="dashboard-actions">
            <Link className="primary-btn dashboard-btn" href="/studio">
              <BroadcastIcon />
              Mở Studio
            </Link>
            <form className="dashboard-watch-form" onSubmit={handleWatchFinderSubmit}>
              <div className="dashboard-watch-input-wrap">
                <PlayIcon />
                <input
                  className="text-input dashboard-watch-input"
                  value={watchQuery}
                  onChange={(event) => setWatchQuery(event.target.value)}
                  placeholder="Xem stream"
                />
              </div>
              <button className="ghost-btn dashboard-btn button-reset" type="submit">
                OK
              </button>
            </form>
          </div>

          {showWatchFinder ? (
            <div className="dashboard-watch-results">
              <div className="dashboard-watch-results-head">
                <span className="section-kicker">Phòng đang available</span>
                <strong>{availableWatchStreams.length}</strong>
              </div>

              {availableWatchStreams.length ? (
                <div className="dashboard-watch-results-list">
                  {availableWatchStreams.map((stream) => (
                    <Link className="dashboard-watch-result" href={stream.watchPath} key={stream.streamKey}>
                      <div className="dashboard-watch-result-copy">
                        <strong>{stream.title}</strong>
                        <span>{stream.streamKey}</span>
                      </div>
                      <span className="status-pill status-live">LIVE</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Không có phòng live phù hợp để vào xem.</p>
              )}
            </div>
          ) : null}

          <div className="dashboard-metrics-bar">
            {heroMetrics.map((metric) => (
              <article
                className={`dashboard-metric-chip${metric.tone === "accent" ? " dashboard-metric-chip-accent" : ""}`}
                key={metric.label}
              >
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </article>
            ))}
          </div>
        </div>

        <aside className="dashboard-hero-status">
          <div className="live-status-head">
            <div>
              <p className="section-kicker">Realtime status</p>
              <h2>{liveStream ? liveStream.title : "Không có phiên live đang phát"}</h2>
            </div>
            <span className={`status-pill ${liveStream ? "status-live" : "status-idle"} dashboard-status-pill`}>
              <span className="pulse-dot" />
              {liveStream ? "Live" : "Idle"}
            </span>
          </div>

          <div className="live-status-grid">
            <div className="status-line">
              <span>Feed</span>
              <strong>{liveStream ? liveStream.streamKey : "—"}</strong>
            </div>
            <div className="status-line">
              <span>Stats API</span>
              <strong>{statsOnline ? "Online" : "Unavailable"}</strong>
            </div>
            <div className="status-line">
              <span>Playback</span>
              <strong>{liveStream ? "HLS active" : "Waiting for publish"}</strong>
            </div>
            <div className="status-line">
              <span>Updated</span>
              <strong>
                {stats?.fetchedAt
                  ? new Date(stats.fetchedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
                  : "—"}
              </strong>
            </div>
          </div>

          <div className="hero-inline-links">
            <Link href="/stats">Mở Analytics</Link>
            <Link href="/vod">Mở Media</Link>
          </div>
        </aside>
      </section>

      <section className="dashboard-main-grid">
        <section className="dashboard-main-column">
          <article className="dashboard-card dashboard-preview-card dashboard-card-primary">
            <div className="dashboard-card-head">
              <div>
                <p className="section-kicker">Live preview</p>
                <h2>{liveStream ? liveStream.title : "Preview sẽ xuất hiện khi có stream live"}</h2>
              </div>
              <span className={`status-pill ${liveStream ? "status-live" : "status-idle"} dashboard-status-pill`}>
                <span className="pulse-dot" />
                {liveStream ? "On air" : "Standby"}
              </span>
            </div>

            <div className="dashboard-preview-shell">
              {liveStream ? (
                <HlsPlayer
                  compact
                  hideStatus
                  sourcePath={`/hls/${encodeURIComponent(liveStream.streamKey)}/index.m3u8`}
                  streamKey={liveStream.streamKey}
                  title={`Preview ${liveStream.title}`}
                />
              ) : (
                <div className="dashboard-preview-empty">
                  <PlayIcon />
                  <p>Khởi động một phiên live trong Studio để xem preview tại đây.</p>
                </div>
              )}
            </div>

            <div className="dashboard-live-toolbar">
              <div className="dashboard-inline-actions">
                <Link className="ghost-btn small-btn" href={liveStream ? liveStream.watchPath : "/studio"}>
                  <PlayIcon />
                  Mở Watch
                </Link>
                <Link className="ghost-btn small-btn" href="/studio">
                  <BroadcastIcon />
                  Stream controls
                </Link>
              </div>

              <div className="dashboard-inline-metrics">
                {liveMetrics.map((metric) => (
                <div className="dashboard-inline-metric" key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
            </div>
          </article>

          <div className="dashboard-secondary-grid">
            <article className="dashboard-card">
              <div className="dashboard-card-head compact-head">
                <div>
                  <p className="section-kicker">Current stream</p>
                  <h3>Trạng thái phiên hiện tại</h3>
                </div>
              </div>
              <div className="status-matrix">
                <div className="status-matrix-item">
                  <span>Stream key</span>
                  <strong>{liveStream?.streamKey || "—"}</strong>
                </div>
                <div className="status-matrix-item">
                  <span>Adaptive</span>
                  <strong>{liveStream ? "Initializing" : "Idle"}</strong>
                </div>
                <div className="status-matrix-item">
                  <span>Ingress</span>
                  <strong>{liveStream ? "Receiving RTMP" : "No publisher"}</strong>
                </div>
                <div className="status-matrix-item">
                  <span>Recorder</span>
                  <strong>{recordings.length > 0 ? "Archive ready" : "Pending"}</strong>
                </div>
              </div>
            </article>

            <article className="dashboard-card">
              <div className="dashboard-card-head compact-head">
                <div>
                  <p className="section-kicker">Analytics snapshot</p>
                  <h3>Tín hiệu thời gian thực</h3>
                </div>
              </div>
              <div className="telemetry-stack">
                <div className="telemetry-row">
                  <span>Applications online</span>
                  <strong>{formatCount(summary.totalApplications)}</strong>
                </div>
                <div className="telemetry-row">
                  <span>Viewer sessions</span>
                  <strong>{formatCount(summary.totalClients)}</strong>
                </div>
                <div className="telemetry-row">
                  <span>Total inbound bitrate</span>
                  <strong>{formatBitrate(summary.totalInboundBandwidth)}</strong>
                </div>
                <div className="telemetry-row">
                  <span>Recorded assets</span>
                  <strong>{formatCount(recordings.length)}</strong>
                </div>
              </div>
            </article>
          </div>

          <section className="dashboard-feature-grid">
            {featureCards.map(({ href, title, description, meta, Icon }) => (
              <Link className="dashboard-card dashboard-feature-card" href={href} key={title}>
                <div className="dashboard-feature-icon">
                  <Icon />
                </div>
                <div>
                  <p className="section-kicker">{meta}</p>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </Link>
            ))}
          </section>
        </section>

        <aside className="dashboard-sidebar">
          <article className="dashboard-card dashboard-sidebar-card">
            <div className="dashboard-card-head compact-head">
              <div>
                <p className="section-kicker">Recent streams</p>
                <h3>Luồng gần đây</h3>
              </div>
            </div>
            <div className="dashboard-stream-list">
              {recentStreams.length === 0 ? (
                <p className="empty-text">Chưa có stream nào được tạo.</p>
              ) : (
                recentStreams.map((stream) => (
                  <div className="dashboard-stream-item" key={stream.streamKey}>
                    <div className="dashboard-stream-copy">
                      <strong>{stream.title}</strong>
                      <span>{stream.streamKey}</span>
                    </div>
                    <div className="dashboard-stream-tail">
                      <span className={`status-pill status-${stream.status}`}>{stream.status}</span>
                      <Link className="ghost-btn small-btn" href={stream.watchPath}>
                        Mở
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="dashboard-card dashboard-sidebar-card">
            <div className="dashboard-card-head compact-head">
              <div>
                <p className="section-kicker">Quick actions</p>
                <h3>Điều hướng nhanh</h3>
              </div>
            </div>
            <div className="dashboard-quick-grid">
              <Link className="dashboard-quick-action" href="/studio">
                <BroadcastIcon />
                <span>New stream</span>
              </Link>
              <Link className="dashboard-quick-action" href="/vod">
                <StorageIcon />
                <span>Open library</span>
              </Link>
              <Link className="dashboard-quick-action" href="/vod">
                <CameraIcon />
                <span>Review archive</span>
              </Link>
              <Link className="dashboard-quick-action" href={liveStream ? liveStream.watchPath : "/studio"}>
                <PlayIcon />
                <span>Open watch</span>
              </Link>
            </div>
          </article>

          <article className="dashboard-card dashboard-sidebar-card">
            <div className="dashboard-card-head compact-head">
              <div>
                <p className="section-kicker">System health</p>
                <h3>Sức khỏe dịch vụ</h3>
              </div>
            </div>
            <div className="health-list">
              <div className="health-row">
                <span>Stats endpoint</span>
                <strong className={statsOnline ? "health-good" : "health-warn"}>
                  {statsOnline ? "Operational" : "Unavailable"}
                </strong>
              </div>
              <div className="health-row">
                <span>Live pipeline</span>
                <strong className={liveStream ? "health-good" : ""}>
                  {liveStream ? "Publishing" : "Idle"}
                </strong>
              </div>
              <div className="health-row">
                <span>Archive pipeline</span>
                <strong>{recordings.length > 0 ? "Ready" : "Waiting"}</strong>
              </div>
              <div className="health-row">
                <span>Realtime preview</span>
                <strong>{liveStream ? "Active" : "Offline"}</strong>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
