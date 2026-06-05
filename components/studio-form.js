"use client";

import { useEffect, useState } from "react";
import { getHlsBaseUrl } from "components/hls-base-url";
import HlsPlayer from "components/hls-player";
import {
  BroadcastIcon,
  LinkIcon,
  PlayIcon,
  PulseIcon
} from "components/system-icons";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildActiveTargets(stream) {
  const targets = [];

  if (stream?.restreamYoutube) {
    targets.push({
      provider: "youtube",
      url: `rtmp://a.rtmp.youtube.com/live2/${stream.restreamYoutube}`
    });
  }

  if (stream?.restreamFacebook) {
    targets.push({
      provider: "facebook",
      url: `rtmps://live-api-s.facebook.com:443/rtmp/${stream.restreamFacebook}`
    });
  }

  return targets;
}

export default function StudioForm({ compact = false }) {
  const [title, setTitle] = useState("Demo stream");
  const [customKey, setCustomKey] = useState("");
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [restreamYoutubeKey, setRestreamYoutubeKey] = useState("");
  const [restreamFacebookKey, setRestreamFacebookKey] = useState("");
  const [stream, setStream] = useState({
    streamKey: "demo-stream",
    publishServer: "rtmp://localhost:1935/live",
    watchPath: "/watch/demo-stream",
    recordEnabled: true,
    restreamYoutube: "",
    restreamFacebook: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingRestream, setIsApplyingRestream] = useState(false);
  const [status, setStatus] = useState("idle");
  const [streams, setStreams] = useState([]);
  const [restreamState, setRestreamState] = useState("");
  const [restreamError, setRestreamError] = useState("");
  const [activeTargets, setActiveTargets] = useState([]);
  const [deletingKey, setDeletingKey] = useState("");
  const [statsSummary, setStatsSummary] = useState({
    liveStreams: 0,
    viewers: 0,
    inboundBandwidth: 0,
    outboundBandwidth: 0
  });
  const [adaptiveState, setAdaptiveState] = useState("checking");
  const [activityLog, setActivityLog] = useState([
    {
      id: 1,
      level: "info",
      message: "Studio control room đã sẵn sàng.",
      time: new Date().toLocaleTimeString("vi-VN")
    }
  ]);

  const previewKey = slugify(customKey) || slugify(title) || "demo-stream";

  function pushActivity(message, level = "info") {
    setActivityLog((current) => [
      {
        id: Date.now() + Math.random(),
        level,
        message,
        time: new Date().toLocaleTimeString("vi-VN")
      },
      ...current
    ].slice(0, 8));
  }

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      pushActivity(`Đã sao chép ${label}.`, "success");
    } catch {
      pushActivity(`Không thể sao chép ${label}.`, "error");
    }
  }

  function summarizeStats(applications) {
    const summary = {
      liveStreams: 0,
      viewers: 0,
      inboundBandwidth: 0,
      outboundBandwidth: 0
    };

    for (const application of applications || []) {
      for (const liveStream of application.live || []) {
        summary.liveStreams += 1;
        summary.viewers += Number(liveStream.nclients || 0);
        summary.inboundBandwidth += Number(liveStream.bandwidthIn || 0);
        summary.outboundBandwidth += Number(liveStream.bandwidthOut || 0);
      }
    }

    return summary;
  }

  async function handleCreateStream(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const normalizedCustomKey = slugify(customKey);
    const normalizedCurrentStreamKey = slugify(stream?.streamKey || "");
    const effectiveCustomKey =
      normalizedCustomKey && normalizedCustomKey === normalizedCurrentStreamKey
        ? ""
        : customKey;

    try {
      const response = await fetch("/api/streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          customKey: effectiveCustomKey,
          recordEnabled,
          restreamYoutubeKey,
          restreamFacebookKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create stream.");
        return;
      }

      setStream(data);
      // Clear the custom key after creation so the next submit does not
      // accidentally reuse an existing stream key and trigger a duplicate error.
      setCustomKey("");
      setStatus(data.status);
      pushActivity(`Đã tạo stream "${data.title}" với key ${data.streamKey}.`, "success");

      await applyRestreamTargets(restreamYoutubeKey, restreamFacebookKey, data.streamKey);

      await loadStreams();
    } catch {
      setError("Khong the tao stream luc nay.");
      pushActivity("Không thể tạo stream ở thời điểm hiện tại.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function scrollToDashboardSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function applyRestreamTargets(youtubeKey, facebookKey, targetStreamKey = stream.streamKey) {
    setIsApplyingRestream(true);
    setRestreamError("");
    setRestreamState("");

    try {
      if (!targetStreamKey) {
        setRestreamError("Hãy tạo stream trước khi áp dụng restream.");
        pushActivity("Chưa có stream key để lưu cấu hình restream.", "error");
        return false;
      }

      const restreamResponse = await fetch("/api/restream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          streamKey: targetStreamKey,
          youtubeKey,
          facebookKey
        })
      });

      const restreamData = await restreamResponse.json();

      if (!restreamResponse.ok) {
        setRestreamError(restreamData.error || "Khong the apply restream target.");
        setActiveTargets(restreamData.targets || []);
        pushActivity("Áp dụng restream thất bại.", "error");
        return false;
      }

      if (restreamData.targets?.length > 0) {
        setRestreamState(restreamData.message || "Restream target đã được lưu.");
        setActiveTargets(restreamData.targets || []);
        pushActivity(`Đã áp dụng ${restreamData.targets.length} restream target.`, "success");
      } else {
        setRestreamState(restreamData.message || "Đã xóa toàn bộ restream target đang hoạt động.");
        setActiveTargets([]);
        pushActivity("Đã xóa toàn bộ restream target đang hoạt động.", "info");
      }

      await loadStreams();
      return true;
    } catch {
      setRestreamError("Khong the apply restream target luc nay.");
      pushActivity("Không thể cập nhật cấu hình restream.", "error");
      return false;
    } finally {
      setIsApplyingRestream(false);
    }
  }

  async function handleApplyRestream() {
    await applyRestreamTargets(restreamYoutubeKey, restreamFacebookKey, stream.streamKey);
  }

  async function handleClearRestream() {
    setRestreamYoutubeKey("");
    setRestreamFacebookKey("");
    await applyRestreamTargets("", "");
  }

  async function handleDeleteStream(targetStream) {
    if (!targetStream?.streamKey || targetStream.status === "live") {
      return;
    }

    setDeletingKey(targetStream.streamKey);
    setError("");

    try {
      const response = await fetch(`/api/streams/${encodeURIComponent(targetStream.streamKey)}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Không thể xóa stream.");
        pushActivity(`Xóa stream ${targetStream.streamKey} thất bại.`, "error");
        return;
      }

      if (stream.streamKey === targetStream.streamKey) {
        setStream({
          streamKey: "demo-stream",
          publishServer: "rtmp://localhost:1935/live",
          watchPath: "/watch/demo-stream",
          recordEnabled: true,
          restreamYoutube: "",
          restreamFacebook: ""
        });
        setStatus("idle");
      }

      pushActivity(`Đã xóa stream ${targetStream.streamKey}.`, "success");
      await loadStreams();
    } catch {
      setError("Không thể xóa stream ở thời điểm hiện tại.");
      pushActivity(`Xóa stream ${targetStream?.streamKey || ""} thất bại.`, "error");
    } finally {
      setDeletingKey("");
    }
  }

  async function loadStreams() {
    try {
      const response = await fetch("/api/streams", {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) {
        return;
      }

      setStreams(data.streams || []);

      const matchedStream = (data.streams || []).find(
        (item) => item.streamKey === stream.streamKey
      );

      if (matchedStream) {
        if (matchedStream.status !== status) {
          pushActivity(
            `Trạng thái stream ${matchedStream.streamKey} chuyển sang ${matchedStream.status}.`,
            matchedStream.status === "live" ? "success" : "info"
          );
        }
        setStream(matchedStream);
        setStatus(matchedStream.status);
        setActiveTargets(buildActiveTargets(matchedStream));
      }
    } catch {
      // Keep current UI state if polling fails.
    }
  }

  async function loadStats() {
    try {
      const response = await fetch("/api/stats", {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) {
        return;
      }

      setStatsSummary(summarizeStats(data.applications || []));
    } catch {
      // Keep previous stats when polling fails.
    }
  }

  async function loadAdaptiveStatus() {
    if (!stream.streamKey) {
      setAdaptiveState("idle");
      return;
    }

    try {
      const response = await fetch(`${getHlsBaseUrl()}/hls/${encodeURIComponent(stream.streamKey)}/master.m3u8`, {
        method: "HEAD"
      });

      if (response.ok) {
        setAdaptiveState("ready");
        return;
      }

      setAdaptiveState(status === "live" ? "warming" : "idle");
    } catch {
      setAdaptiveState(status === "live" ? "warming" : "idle");
    }
  }

  useEffect(() => {
    loadStreams();
    loadStats();
    loadAdaptiveStatus();
    const intervalId = window.setInterval(() => {
      loadStreams();
      loadStats();
      loadAdaptiveStatus();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [stream.streamKey]);

  const publishServer = stream.publishServer;
  const localHls = stream.watchPath;
  const streamKey = stream.streamKey;
  const adaptiveLabel =
    adaptiveState === "ready"
      ? "Adaptive live sẵn sàng"
      : adaptiveState === "warming"
        ? "Adaptive live đang khởi tạo"
        : "Adaptive live chưa sẵn sàng";
  const adaptiveClass =
    adaptiveState === "ready"
      ? "status-live"
      : adaptiveState === "warming"
        ? "status-unknown"
        : "status-idle";

  return (
    <div className="studio-layout">
      <section className="hero-card control-room-panel">
        <div className="hero-badge-row">
          <p className="eyebrow">Live production</p>
          <span className={`status-pill status-${status}`}>{status}</span>
        </div>
        <h1>Điều phối luồng phát</h1>
        <p className="hero-copy">
          Tạo stream key, áp dụng restream, lấy thông số publish cho OBS và theo dõi
          trạng thái phát theo thời gian thực.
        </p>

        <div className="control-strip">
          <div className="control-chip">
            <BroadcastIcon />
            <div>
              <span className="metric-label">Nguồn phát</span>
              <strong>{statsSummary.liveStreams} luồng đang hoạt động</strong>
            </div>
          </div>
          <div className="control-chip">
            <PlayIcon />
            <div>
              <span className="metric-label">Viewer realtime</span>
              <strong>{statsSummary.viewers} kết nối xem</strong>
            </div>
          </div>
          <div className="control-chip">
            <PulseIcon />
            <div>
              <span className="metric-label">Băng thông</span>
              <strong>
                In {statsSummary.inboundBandwidth} · Out {statsSummary.outboundBandwidth}
              </strong>
            </div>
          </div>
          <div className="control-chip">
            <LinkIcon />
            <div>
              <span className="metric-label">Adaptive live</span>
              <strong>{adaptiveLabel}</strong>
            </div>
          </div>
        </div>

        <form className="studio-form" onSubmit={handleCreateStream}>
          <div className="form-grid">
            <label className="field-block">
              <span className="field-label">Stream title</span>
              <input
                className="text-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ví dụ: Demo stream"
              />
            </label>

            <label className="field-block">
              <span className="field-label">Stream key tùy chỉnh</span>
              <input
                className="text-input"
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="ví dụ: demo-live"
              />
            </label>

            <label className="field-block">
              <span className="field-label">Khóa luồng YouTube</span>
              <input
                className="text-input"
                value={restreamYoutubeKey}
                onChange={(event) => setRestreamYoutubeKey(event.target.value)}
                placeholder="abcd-efgh-1234-5678"
              />
            </label>

            <label className="field-block">
              <span className="field-label">Khóa luồng Facebook</span>
              <input
                className="text-input"
                value={restreamFacebookKey}
                onChange={(event) => setRestreamFacebookKey(event.target.value)}
                placeholder="FB-xxxxxxxx-0-xxxxxxxx"
              />
            </label>

            <div className="field-block">
              <span className="field-label">Lưu lại livestream</span>
              <div className="option-toggle" role="radiogroup" aria-label="Lưu lại livestream">
                <button
                  type="button"
                  className={`option-toggle-btn button-reset${recordEnabled ? " option-toggle-btn-active" : ""}`}
                  onClick={() => setRecordEnabled(true)}
                  aria-pressed={recordEnabled}
                >
                  Có, lưu vào thư viện
                </button>
                <button
                  type="button"
                  className={`option-toggle-btn button-reset${!recordEnabled ? " option-toggle-btn-active" : ""}`}
                  onClick={() => setRecordEnabled(false)}
                  aria-pressed={!recordEnabled}
                >
                  Không lưu recording
                </button>
              </div>
            </div>
          </div>

          <div className="hero-actions compact-actions">
            <button className="primary-btn button-reset" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create stream"}
            </button>
            <button
              className="ghost-btn button-reset"
              type="button"
              disabled={isApplyingRestream}
              onClick={handleApplyRestream}
            >
              {isApplyingRestream ? "Đang áp dụng..." : "Áp dụng restream"}
            </button>
            <button
              className="ghost-btn button-reset"
              type="button"
              disabled={isApplyingRestream}
              onClick={handleClearRestream}
            >
              Xóa restream
            </button>
          </div>
        </form>

        <div className="stack-block">
          <div className="label">Xem trước stream key</div>
          <code className="inline-code">{previewKey}</code>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {restreamError ? <p className="error-text">{restreamError}</p> : null}
        {restreamState ? <p className="success-text">{restreamState}</p> : null}

        <div className="info-grid studio-grid control-room-grid">
          <article className="info-card control-room-card">
            <h2>Thông số publish</h2>
            <div className="stack-block">
              <div className="label">Máy chủ RTMP</div>
              <div className="inline-code-row">
                <code className="inline-code">{publishServer}</code>
                <button
                  className="ghost-btn small-btn button-reset"
                  type="button"
                  onClick={() => copyToClipboard(publishServer, "máy chủ RTMP")}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="stack-block">
              <div className="label">Khóa luồng</div>
              <div className="inline-code-row">
                <code className="inline-code">{streamKey}</code>
                <button
                  className="ghost-btn small-btn button-reset"
                  type="button"
                  onClick={() => copyToClipboard(streamKey, "stream key")}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="stack-block">
              <div className="label">Trạng thái hiện tại</div>
              <span className={`status-pill status-${status}`}>{status}</span>
            </div>
            <div className="stack-block">
              <div className="label">Recording</div>
              <span className={`status-pill ${stream.recordEnabled ? "status-live" : "status-idle"}`}>
                {stream.recordEnabled ? "Đang lưu" : "Không lưu"}
              </span>
            </div>
            <div className="stack-block">
              <div className="label">Adaptive HLS</div>
              <span className={`status-pill ${adaptiveClass}`}>{adaptiveLabel}</span>
            </div>
          </article>

          <article className="info-card control-room-card">
            <h2>Playback routing</h2>
            <div className="stack-block">
              <div className="label">Trang xem Auto</div>
              <div className="inline-code-row">
                <code className="inline-code">{localHls}</code>
                <button
                  className="ghost-btn small-btn button-reset"
                  type="button"
                  onClick={() => copyToClipboard(localHls, "đường dẫn xem")}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="stack-block">
              <div className="label">Flow</div>
              <p className="hero-copy studio-flow-copy">
                Tạo stream trong Studio, phát từ OBS, sau đó chuyển sang Watch để xem live ở chế độ Auto hoặc chọn 240p, 480p, 720p.
              </p>
            </div>
            <div className="hero-actions compact-actions">
              <button className="primary-btn button-reset" type="button" onClick={() => scrollToDashboardSection("live")}>
                <PlayIcon />
                Xem Live Auto
              </button>
              <button className="ghost-btn button-reset" type="button" onClick={() => scrollToDashboardSection("stats")}>
                <PulseIcon />
                Xem Stats
              </button>
            </div>
          </article>
        </div>

        <div className="info-grid studio-grid control-room-grid">
          <article className="info-card compact-card control-room-card">
            <h2>Mini preview</h2>
            <p className="hero-copy">
              Xem nhanh luồng HLS của stream đang chọn ngay trong studio control room.
            </p>
            <HlsPlayer streamKey={streamKey} compact />
          </article>

          <article className="info-card compact-card control-room-card">
            <h2>Activity timeline</h2>
            <p className="hero-copy">
              Nhật ký thao tác gần nhất cho việc tạo stream, đổi trạng thái và cập nhật restream.
            </p>
            <div className="timeline-list">
              {activityLog.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <span className={`timeline-dot timeline-${entry.level}`} />
                  <div className="timeline-content">
                    <div className="timeline-message">{entry.message}</div>
                    <div className="timeline-time">{entry.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="info-card compact-card control-room-card">
          <h2>Camera setup trong OBS</h2>
          <ul>
            <li>Service: chọn <code>Custom</code>.</li>
            <li>Server: <code>{publishServer}</code>.</li>
            <li>Stream Key: <code>{streamKey}</code>.</li>
            <li>Thêm nguồn chính bằng <code>Display Capture</code>, <code>Window Capture</code>, <code>Game Capture</code> hoặc <code>Media Source</code>.</li>
            <li>Thêm webcam bằng <code>Video Capture Device</code>.</li>
            <li>Resize và đặt vị trí webcam trực tiếp trong scene OBS theo kiểu picture-in-picture.</li>
            <li>Dùng cùng một stream key để OBS gửi toàn bộ scene đã trộn sẵn lên server.</li>
          </ul>
        </div>

        <div className="info-card compact-card control-room-card">
          <h2>Cấu hình restream</h2>
          <ul>
            <li>Khóa YouTube: {stream.restreamYoutube || "Chưa cấu hình"}</li>
            <li>Khóa Facebook: {stream.restreamFacebook || "Chưa cấu hình"}</li>
            <li>
              Bạn chỉ cần nhập stream key, hệ thống sẽ tự ghép đúng server URL cho YouTube và Facebook.
            </li>
            <li>Target được lưu trực tiếp theo từng stream hiện tại.</li>
            <li>Worker <code>ffmpeg</code> sẽ tự khởi động khi stream publish và tự dừng khi stream kết thúc.</li>
            <li><LinkIcon /> Có thể áp dụng hoặc xóa target ngay trong Studio.</li>
          </ul>
          {activeTargets.length > 0 ? (
            <div className="stack-block">
              <div className="label">Push target đang hoạt động</div>
              <div className="stream-list">
                {activeTargets.map((target) => (
                  <div className="stream-item" key={target.provider}>
                    <div>
                      <div className="stream-title">{target.provider}</div>
                      <code className="stream-key">{target.url}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="info-card compact-card control-room-card">
          <h2>Các stream gần đây</h2>
          {streams.length === 0 ? (
            <p className="empty-text">Chưa có stream nào được tạo.</p>
          ) : (
            <div className="stream-list">
              {streams.map((item) => (
                <div className="stream-item" key={item.id}>
                  <div>
                    <div className="stream-title">{item.title}</div>
                    <code className="stream-key">{item.streamKey}</code>
                    <div className="recording-meta">
                      <span>yt: {item.restreamYoutube ? "set" : "none"}</span>
                      <span>fb: {item.restreamFacebook ? "set" : "none"}</span>
                    </div>
                  </div>
                  <div className="stream-actions">
                    <span className={`status-pill status-${item.status}`}>{item.status}</span>
                    <button
                      className="ghost-btn small-btn button-reset"
                      onClick={() => scrollToDashboardSection("live")}
                      type="button"
                    >
                      Watch
                    </button>
                    <button
                      className="ghost-btn small-btn button-reset"
                      type="button"
                      disabled={item.status === "live" || deletingKey === item.streamKey}
                      onClick={() => handleDeleteStream(item)}
                    >
                      {deletingKey === item.streamKey ? "Đang xóa..." : "Xóa"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
