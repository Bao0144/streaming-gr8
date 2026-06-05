"use client";

import { useEffect, useState } from "react";

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatBandwidth(bytesPerSecond) {
  const value = Number(bytesPerSecond || 0);
  if (value <= 0) {
    return "0 B/s";
  }

  return `${formatBytes(value)}/s`;
}

function formatTime(value) {
  if (!value) {
    return "Chưa có";
  }

  return new Date(value).toLocaleString("vi-VN");
}

export default function StatsConsole({ initialData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pollDelay, setPollDelay] = useState(4000);

  async function loadStats({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }
    setError("");

    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Không thể tải thống kê livestream.");
        setPollDelay(12000);
        return;
      }

      setData(payload);
      setPollDelay(4000);
    } catch {
      setError("Không thể tải thống kê livestream.");
      setPollDelay(12000);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  function scrollToDashboardSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadStats({ silent: true });
    }, pollDelay);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pollDelay]);

  const applications = data?.applications || [];
  const summary = data?.summary || {
    applications: 0,
    liveStreams: 0,
    viewers: 0,
    inboundBandwidth: 0,
    outboundBandwidth: 0,
    bytesIn: 0,
    bytesOut: 0
  };

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div className="hero-badge-row">
          <p className="eyebrow">Realtime monitoring</p>
          <span className={`status-pill ${summary.liveStreams > 0 ? "status-live" : "status-idle"}`}>
            {summary.liveStreams > 0 ? "LIVE" : "IDLE"}
          </span>
        </div>
        <h1>Thống kê livestream thời gian thực</h1>
        <p className="hero-copy">
          Theo dõi application RTMP, luồng đang phát, số viewer và băng thông vào/ra theo thời gian thực từ Nginx RTMP.
        </p>

        <div className="hero-actions compact-actions">
          <button className="ghost-btn button-reset" type="button" onClick={() => loadStats()} disabled={loading}>
            {loading ? "Đang làm mới..." : "Làm mới ngay"}
          </button>
          <button className="ghost-btn button-reset" type="button" onClick={() => scrollToDashboardSection("studio")}>
            Quay lại Studio
          </button>
          <a className="ghost-btn" href="http://localhost:8080/stat">
            Mở XML gốc
          </a>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="control-strip">
          <div className="control-chip">
            <div>
              <span className="metric-label">Applications</span>
              <strong>{summary.applications}</strong>
            </div>
          </div>
          <div className="control-chip">
            <div>
              <span className="metric-label">Luồng live</span>
              <strong>{summary.liveStreams}</strong>
            </div>
          </div>
          <div className="control-chip">
            <div>
              <span className="metric-label">Viewer realtime</span>
              <strong>{summary.viewers}</strong>
            </div>
          </div>
          <div className="control-chip">
            <div>
              <span className="metric-label">Băng thông</span>
              <strong>{formatBandwidth(summary.inboundBandwidth)} / {formatBandwidth(summary.outboundBandwidth)}</strong>
            </div>
          </div>
        </div>

        <div className="info-grid">
          <article className="info-card compact-card">
            <h2>Tổng quan</h2>
            <div className="stream-list">
              <div className="stream-item">
                <div>
                  <div className="stream-title">Inbound data</div>
                  <div className="recording-meta">
                    <span>{formatBytes(summary.bytesIn)}</span>
                    <span>{formatBandwidth(summary.inboundBandwidth)}</span>
                  </div>
                </div>
              </div>
              <div className="stream-item">
                <div>
                  <div className="stream-title">Outbound data</div>
                  <div className="recording-meta">
                    <span>{formatBytes(summary.bytesOut)}</span>
                    <span>{formatBandwidth(summary.outboundBandwidth)}</span>
                  </div>
                </div>
              </div>
              <div className="stream-item">
                <div>
                  <div className="stream-title">Lần cập nhật gần nhất</div>
                  <div className="recording-meta">
                    <span>{formatTime(data?.fetchedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="info-card compact-card">
            <h2>Live streams</h2>
            {applications.length === 0 ? (
              <p className="empty-text">Chưa đọc được dữ liệu RTMP hoặc chưa có application nào.</p>
            ) : (
              <div className="stream-list">
                {applications.flatMap((application) =>
                  (application.live || []).map((stream) => (
                    <div className="stream-item" key={`${application.name}-${stream.name}`}>
                      <div>
                        <div className="stream-title">{stream.name}</div>
                        <div className="recording-meta">
                          <span>app: {application.name}</span>
                          <span>viewer: {stream.nclients || 0}</span>
                          <span>in: {formatBandwidth(stream.bandwidthIn)}</span>
                          <span>out: {formatBandwidth(stream.bandwidthOut)}</span>
                        </div>
                      </div>
                      <div className="stream-actions">
                        <span className={`status-pill ${stream.publishing ? "status-live" : "status-idle"}`}>
                          {stream.publishing ? "publishing" : "idle"}
                        </span>
                        <button
                          className="ghost-btn small-btn button-reset"
                          onClick={() => scrollToDashboardSection("live")}
                          type="button"
                        >
                          Xem
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        </div>

        <div className="info-card compact-card">
          <h2>Client connections</h2>
          {applications.every((application) => (application.live || []).every((stream) => (stream.clients || []).length === 0)) ? (
            <p className="empty-text">Chưa có client viewer nào được ghi nhận ở thời điểm này.</p>
          ) : (
            <div className="stream-list">
              {applications.flatMap((application) =>
                (application.live || []).flatMap((stream) =>
                  (stream.clients || []).map((client) => (
                    <div className="stream-item" key={`${application.name}-${stream.name}-${client.id || client.address}`}>
                      <div>
                        <div className="stream-title">{client.address || "Unknown client"}</div>
                        <div className="recording-meta">
                          <span>stream: {stream.name}</span>
                          <span>client id: {client.id || "n/a"}</span>
                          <span>timestamp: {client.timestamp || "n/a"}</span>
                          <span>{client.publishing ? "publisher" : "viewer"}</span>
                        </div>
                      </div>
                      <div className="stream-actions">
                        <span className={`status-pill ${client.active ? "status-live" : "status-idle"}`}>
                          {client.active ? "active" : "idle"}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
