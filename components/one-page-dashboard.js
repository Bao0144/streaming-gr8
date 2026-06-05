"use client";

import { useEffect, useMemo, useState } from "react";
import { getHlsBaseUrl } from "components/hls-base-url";
import LiveHlsPlayer from "components/live-hls-player";
import StatsConsole from "components/stats-console";
import StudioForm from "components/studio-form";
import {
  BroadcastIcon,
  CameraIcon,
  PlayIcon,
  PulseIcon,
  StorageIcon
} from "components/system-icons";
import VodConsole from "components/vod-console";

const SECTIONS = [
  { id: "studio", label: "Studio", Icon: BroadcastIcon },
  { id: "live", label: "Live", Icon: PlayIcon },
  { id: "vod", label: "VOD", Icon: StorageIcon },
  { id: "stats", label: "Stats", Icon: PulseIcon },
  { id: "guide", label: "Demo", Icon: CameraIcon }
];

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

export default function OnePageDashboard({ currentUser, initialStats }) {
  const [streams, setStreams] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedStreamKey, setSelectedStreamKey] = useState("");
  const [manualStreamKey, setManualStreamKey] = useState("");
  const [qualityMode, setQualityMode] = useState("auto");
  const [adaptiveReady, setAdaptiveReady] = useState(false);
  const [browserHost, setBrowserHost] = useState("");
  const [playerMetrics, setPlayerMetrics] = useState({
    resolution: "",
    droppedFrames: null,
    totalFrames: null,
    latency: null,
    bufferHealth: null,
    levelLabel: null
  });

  useEffect(() => {
    setBrowserHost(window.location.hostname);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStreams() {
      try {
        const response = await fetch("/api/streams", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || cancelled) {
          return;
        }

        const rooms = data.availableRooms || [];
        setStreams(data.streams || []);
        setAvailableRooms(rooms);
        setSelectedStreamKey((current) => current || rooms[0]?.streamKey || "");
      } catch {
        if (!cancelled) {
          setStreams([]);
          setAvailableRooms([]);
        }
      }
    }

    loadStreams();
    const intervalId = window.setInterval(loadStreams, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const effectiveStreamKey = manualStreamKey.trim() || selectedStreamKey;
  const selectedStream = useMemo(
    () => streams.find((stream) => stream.streamKey === effectiveStreamKey) || null,
    [streams, effectiveStreamKey]
  );

  useEffect(() => {
    let cancelled = false;

    async function checkAdaptiveReady() {
      if (!effectiveStreamKey) {
        setAdaptiveReady(false);
        return;
      }

      try {
        const response = await fetch(
          `${getHlsBaseUrl()}/hls/${encodeURIComponent(effectiveStreamKey)}/master.m3u8`,
          { method: "HEAD", cache: "no-store" }
        );
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
  }, [effectiveStreamKey]);

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const liveSource = buildAdaptiveSource(effectiveStreamKey, qualityMode);
  const liveFallback = buildFallbackSource(effectiveStreamKey);
  const demoHost = browserHost || "localhost";

  return (
    <main className="single-page-shell">
      <section className="single-hero">
        <div className="single-hero-copy">
          <p className="section-kicker">Project 3 - Multimedia streaming</p>
          <h1>Hệ thống Streaming</h1>
          <p className="hero-copy">
            Toàn bộ thao tác demo VOD RTMP/HLS, live camera/OBS, record, restream,
            adaptive quality và thống kê realtime được gom trên cùng dashboard này.
          </p>
        </div>
        <div className="single-hero-status">
          <span className={`status-pill ${availableRooms.length ? "status-live" : "status-idle"}`}>
            {availableRooms.length ? `${availableRooms.length} live` : "idle"}
          </span>
          <span className="status-pill status-idle">Ubuntu + Nginx RTMP</span>
        </div>
      </section>

      <nav className="single-section-nav" aria-label="Streaming dashboard sections">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button className="single-nav-btn button-reset" type="button" onClick={() => scrollToSection(id)} key={id}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <section className="single-section" id="studio">
        <div className="single-section-head">
          <p className="section-kicker">1. Live ingest, record, restream</p>
          <h2>Studio điều khiển</h2>
        </div>
        <StudioForm compact />
      </section>

      <section className="single-section" id="live">
        <div className="single-section-head">
          <p className="section-kicker">2. Live HLS adaptive</p>
          <h2>Xem live và đổi độ phân giải</h2>
        </div>
        <div className="single-live-layout">
          <div className="single-live-player">
            {effectiveStreamKey ? (
              <LiveHlsPlayer
                key={`${effectiveStreamKey}-${qualityMode}`}
                streamKey={effectiveStreamKey}
                sourcePath={liveSource}
                fallbackSourcePath={liveFallback}
                preferAdaptive={qualityMode === "auto"}
                onMetricsChange={setPlayerMetrics}
                title={selectedStream?.title || effectiveStreamKey}
                hideStatus
              />
            ) : (
              <div className="single-empty-stage">
                <strong>Chưa chọn stream</strong>
                <span>Tạo stream ở Studio, phát từ OBS rồi chọn stream key tại đây.</span>
              </div>
            )}
          </div>
          <aside className="info-card compact-card single-live-controls">
            <h3>Điều khiển live</h3>
            <label className="form-label" htmlFor="stream-select">Stream đang live</label>
            <select
              className="text-input"
              id="stream-select"
              value={selectedStreamKey}
              onChange={(event) => {
                setSelectedStreamKey(event.target.value);
                setManualStreamKey("");
              }}
            >
              <option value="">Chọn stream</option>
              {availableRooms.map((stream) => (
                <option value={stream.streamKey} key={stream.streamKey}>
                  {stream.title} - {stream.streamKey}
                </option>
              ))}
            </select>

            <label className="form-label" htmlFor="manual-stream-key">Hoặc nhập stream key</label>
            <input
              className="text-input"
              id="manual-stream-key"
              value={manualStreamKey}
              onChange={(event) => setManualStreamKey(event.target.value)}
              placeholder="demo-stream"
            />

            <div className="quality-switch single-quality-switch">
              {["auto", "240p", "480p", "720p"].map((option) => (
                <button
                  className={`quality-btn button-reset${qualityMode === option ? " quality-btn-active" : ""}`}
                  disabled={option !== "auto" && !adaptiveReady}
                  key={option}
                  onClick={() => setQualityMode(option)}
                  type="button"
                >
                  {option === "auto" ? "Auto" : option}
                </button>
              ))}
            </div>

            <div className="stream-list">
              <div className="stream-item">
                <div>
                  <div className="stream-title">Adaptive</div>
                  <div className="recording-meta">{adaptiveReady ? "Sẵn sàng" : "Đang chờ master.m3u8"}</div>
                </div>
              </div>
              <div className="stream-item">
                <div>
                  <div className="stream-title">Resolution</div>
                  <div className="recording-meta">{playerMetrics.resolution || "Chưa có dữ liệu"}</div>
                </div>
              </div>
              <div className="stream-item">
                <div>
                  <div className="stream-title">Latency / Buffer</div>
                  <div className="recording-meta">
                    {typeof playerMetrics.latency === "number" ? `${playerMetrics.latency.toFixed(1)}s` : "-"}
                    {" / "}
                    {typeof playerMetrics.bufferHealth === "number" ? `${playerMetrics.bufferHealth.toFixed(1)}s` : "-"}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="single-section" id="vod">
        <div className="single-section-head">
          <p className="section-kicker">3. VOD RTMP, HLS, adaptive</p>
          <h2>Thư viện video theo yêu cầu</h2>
        </div>
        <VodConsole currentUser={currentUser} />
      </section>

      <section className="single-section" id="stats">
        <div className="single-section-head">
          <p className="section-kicker">4. Nginx RTMP statistics</p>
          <h2>Thống kê realtime</h2>
        </div>
        <StatsConsole initialData={initialStats} />
      </section>

      <section className="single-section" id="guide">
        <div className="single-section-head">
          <p className="section-kicker">5. Checklist demo nhanh</p>
          <h2>Luồng thao tác trên Ubuntu</h2>
        </div>
        <div className="single-guide-grid">
          <article className="info-card compact-card">
            <h3>Khởi động</h3>
            <code>./scripts/start-web.sh</code>
            <code>./scripts/start.sh</code>
            <p>Mở duy nhất <strong>http://localhost:3000/</strong> để thao tác mọi chức năng.</p>
          </article>
          <article className="info-card compact-card">
            <h3>OBS / Camera</h3>
            <code>Server: rtmp://{demoHost}:1935/live</code>
            <code>Stream Key: key tạo ở Studio</code>
            <p>Thêm Display Capture, Window Capture hoặc Video Capture Device để demo camera.</p>
          </article>
          <article className="info-card compact-card">
            <h3>VOD</h3>
            <code>./scripts/generate-vod-hls.sh videos/sample.mp4 sample</code>
            <code>rtmp://{demoHost}:1935/vod/mp4:sample.mp4</code>
            <p>Đồng bộ thư viện ngay trong khu vực VOD rồi chọn HLS/RTMP/adaptive bằng nút trên trang.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
