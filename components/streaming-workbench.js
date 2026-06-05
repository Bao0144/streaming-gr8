"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getHlsBaseUrl, toAbsoluteHlsUrl } from "components/hls-base-url";

const PANELS = [
  { id: "overview", label: "Tổng quan" },
  { id: "live", label: "Live" },
  { id: "vod", label: "VOD" },
  { id: "monitor", label: "Giám sát" },
  { id: "guide", label: "Demo" }
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function rewriteRtmpUrl(url, host) {
  if (!host) {
    return url;
  }

  return String(url || "").replace(/^rtmp:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?/i, (_, port = ":1935") => (
    `rtmp://${host}${port}`
  ));
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatBandwidth(value) {
  const bytes = Number(value || 0);
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB/s`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB/s`;
  }
  return `${bytes} B/s`;
}

function useHls(videoRef, source, fallbackSource = "") {
  const [state, setState] = useState(source ? "Đang nạp playlist..." : "Chưa chọn nguồn phát.");

  useEffect(() => {
    let disposed = false;
    let hls = null;
    const video = videoRef.current;

    if (!video || !source) {
      setState("Chưa chọn nguồn phát.");
      return undefined;
    }

    async function playlistExists(url) {
      if (!url) {
        return false;
      }

      try {
        const response = await fetch(toAbsoluteHlsUrl(url), { method: "HEAD", cache: "no-store" });
        return response.ok;
      } catch {
        return false;
      }
    }

    async function attach() {
      const primarySrc = toAbsoluteHlsUrl(source);
      const fallbackSrc = fallbackSource ? toAbsoluteHlsUrl(fallbackSource) : "";
      const src = (await playlistExists(source)) ? primarySrc : (fallbackSrc || primarySrc);
      setState("Đang nạp playlist...");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.load();
        setState("Sẵn sàng phát.");
        return;
      }

      try {
        const hlsModule = await import("hls.js");
        const Hls = hlsModule.default;

        if (disposed) {
          return;
        }

        if (!Hls.isSupported()) {
          video.src = src;
          video.load();
          setState("Sẵn sàng phát.");
          return;
        }

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => setState("Sẵn sàng phát."));
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data?.fatal) {
            if (fallbackSrc && fallbackSrc !== src) {
              hls.loadSource(fallbackSrc);
              setState("Master playlist chưa sẵn sàng, đã chuyển sang HLS thường.");
              return;
            }
            setState("Không phát được playlist HLS.");
          }
        });
      } catch {
        setState("Không khởi tạo được HLS player.");
      }
    }

    attach();

    return () => {
      disposed = true;
      if (hls) {
        hls.destroy();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [fallbackSource, source, videoRef]);

  return state;
}

function Player({ fallbackSource = "", source, title }) {
  const videoRef = useRef(null);
  const state = useHls(videoRef, source, fallbackSource);

  return (
    <div className="sw-player">
      <video ref={videoRef} controls muted playsInline preload="metadata" aria-label={title} />
      <div className="sw-player-status">{state}</div>
    </div>
  );
}

export default function StreamingWorkbench({ currentUser }) {
  const [activePanel, setActivePanel] = useState("overview");
  const [host, setHost] = useState("localhost");
  const [streams, setStreams] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [selectedLiveKey, setSelectedLiveKey] = useState("");
  const [selectedVodId, setSelectedVodId] = useState("");
  const [liveQuality, setLiveQuality] = useState("auto");
  const [vodQuality, setVodQuality] = useState("auto");
  const [title, setTitle] = useState("Demo stream");
  const [customKey, setCustomKey] = useState("");
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [youtubeKey, setYoutubeKey] = useState("");
  const [facebookKey, setFacebookKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHost(window.location.hostname);
  }, []);

  async function loadStreams() {
    try {
      const response = await fetch("/api/streams", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        return;
      }
      setStreams(data.streams || []);
      setLiveStreams(data.availableRooms || []);
      setSelectedLiveKey((current) => current || data.availableRooms?.[0]?.streamKey || "");
    } catch {
      // Keep the last known data visible.
    }
  }

  async function loadStats() {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const data = await response.json();
      setStats(response.ok ? data : null);
    } catch {
      setStats(null);
    }
  }

  async function loadVideos({ sync = false } = {}) {
    try {
      const response = await fetch(`/api/vod/library${sync ? "?sync=1" : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        return;
      }
      setVideos(data.videos || []);
      setSelectedVodId((current) => current || data.videos?.[0]?.id || "");
      if (sync) {
        setMessage("Đã đồng bộ thư viện VOD.");
      }
    } catch {
      setMessage("Không đọc được thư viện VOD.");
    }
  }

  useEffect(() => {
    loadStreams();
    loadStats();
    loadVideos();
    const interval = window.setInterval(() => {
      loadStreams();
      loadStats();
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedLive = useMemo(
    () => liveStreams.find((stream) => stream.streamKey === selectedLiveKey)
      || streams.find((stream) => stream.streamKey === selectedLiveKey)
      || null,
    [liveStreams, selectedLiveKey, streams]
  );

  const selectedVod = useMemo(
    () => videos.find((video) => video.id === selectedVodId) || videos[0] || null,
    [selectedVodId, videos]
  );

  const liveSource = selectedLiveKey
    ? liveQuality === "auto"
      ? `/hls/${encodeURIComponent(selectedLiveKey)}/master.m3u8`
      : `/hls/${encodeURIComponent(selectedLiveKey)}/${liveQuality}.m3u8`
    : "";
  const liveFallback = selectedLiveKey ? `/hls/${encodeURIComponent(selectedLiveKey)}/index.m3u8` : "";

  const vodOptions = selectedVod?.hlsPlayback?.options || [];
  const selectedVodOption = vodOptions.find((option) => option.id === vodQuality)
    || vodOptions[0]
    || null;
  const vodSource = selectedVodOption?.path || selectedVod?.hlsUrl || "";
  const publishServer = `rtmp://${host}:1935/live`;
  const selectedVodRtmp = rewriteRtmpUrl(selectedVod?.rtmpUrl || "", host);
  const summary = stats?.summary || {};

  async function createStream(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          customKey: slugify(customKey),
          recordEnabled,
          restreamYoutubeKey: youtubeKey,
          restreamFacebookKey: facebookKey
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Không tạo được stream.");
        return;
      }
      setSelectedLiveKey(data.streamKey);
      setActivePanel("live");
      setCustomKey("");
      setMessage(`Đã tạo stream key: ${data.streamKey}`);
      await loadStreams();
      if (youtubeKey || facebookKey) {
        await applyRestream(data.streamKey);
      }
    } catch {
      setMessage("Không tạo được stream.");
    } finally {
      setBusy(false);
    }
  }

  async function applyRestream(targetKey = selectedLiveKey || streams[0]?.streamKey || "") {
    if (!targetKey) {
      setMessage("Hãy tạo hoặc chọn stream trước khi cấu hình restream.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/restream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamKey: targetKey,
          youtubeKey,
          facebookKey
        })
      });
      const data = await response.json();
      setMessage(response.ok ? (data.message || "Đã lưu restream.") : (data.error || "Restream lỗi."));
      await loadStreams();
    } catch {
      setMessage("Không áp dụng được restream.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value, label) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setMessage(`Đã sao chép ${label}.`);
    } catch {
      setMessage(`Không sao chép được ${label}. Bạn có thể bôi đen và copy thủ công.`);
    }
  }

  return (
    <main className="sw-page">
      <aside className="sw-sidebar">
        <div className="sw-brand">
          <span className="sw-brand-mark">S</span>
          <div>
            <strong>Hệ thống Streaming</strong>
            <small>Project 3</small>
          </div>
        </div>
        <nav className="sw-nav">
          {PANELS.map((panel) => (
            <button
              className={activePanel === panel.id ? "sw-nav-item sw-nav-item-active" : "sw-nav-item"}
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              type="button"
            >
              {panel.label}
            </button>
          ))}
        </nav>
        <div className="sw-endpoint">
          <span>Web</span>
          <code>http://{host}:3000</code>
          <span>RTMP</span>
          <code>{publishServer}</code>
        </div>
      </aside>

      <section className="sw-content">
        <header className="sw-header">
          <div>
            <p>Dashboard vận hành</p>
            <h1>Streaming Server</h1>
          </div>
          <div className="sw-user">
            <span>{currentUser?.username || "user"}</span>
            <button type="button" onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => { window.location.href = "/login"; })}>
              Đăng xuất
            </button>
          </div>
        </header>

        {message ? <div className="sw-message">{message}</div> : null}

        <section className="sw-metrics">
          <article><span>Live</span><strong>{formatNumber(summary.liveStreams)}</strong></article>
          <article><span>Viewer</span><strong>{formatNumber(summary.viewers)}</strong></article>
          <article><span>VOD</span><strong>{formatNumber(videos.length)}</strong></article>
          <article><span>Inbound</span><strong>{formatBandwidth(summary.inboundBandwidth)}</strong></article>
        </section>

        {activePanel === "overview" ? (
          <div className="sw-grid sw-grid-two">
            <article className="sw-panel">
              <h2>Luồng thao tác</h2>
              <ol className="sw-steps">
                <li>Tạo stream key trong tab Live.</li>
                <li>OBS publish vào <code>{publishServer}</code>.</li>
                <li>Xem live, đổi quality hoặc bật restream.</li>
                <li>Recording sau khi dừng stream sẽ xuất hiện ở VOD.</li>
              </ol>
              <div className="sw-note">
                <b>Nếu OBS cứ Disconnect/Reconnect</b>
                <span>Hãy kiểm tra đúng Stream Key vừa tạo, Next.js web vẫn đang chạy ở port 3000, Nginx đang chạy ở port 1935, và OBS dùng Server <code>{publishServer}</code>. Nginx sẽ từ chối publish nếu key không tồn tại.</span>
              </div>
            </article>
            <article className="sw-panel">
              <h2>Stream gần đây</h2>
              <div className="sw-list">
                {streams.slice(0, 6).map((stream) => (
                  <button className="sw-list-row" key={stream.id} onClick={() => { setSelectedLiveKey(stream.streamKey); setActivePanel("live"); }} type="button">
                    <span>{stream.title}</span>
                    <code>{stream.streamKey}</code>
                    <b>{stream.status}</b>
                  </button>
                ))}
                {!streams.length ? <p className="sw-empty">Chưa có stream.</p> : null}
              </div>
            </article>
          </div>
        ) : null}

        {activePanel === "live" ? (
          <div className="sw-grid sw-grid-live">
            <article className="sw-panel">
              <h2>Tạo luồng phát</h2>
              <form className="sw-form" onSubmit={createStream}>
                <label>Tiêu đề<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
                <label>Stream key tùy chọn<input value={customKey} onChange={(event) => setCustomKey(event.target.value)} placeholder="demo-live" /></label>
                <div className="sw-note">
                  <b>Restream YouTube/Facebook</b>
                  <span>Nhập key nền tảng ngoài, chọn stream đang có rồi bấm nút bên dưới để lưu target. Khi OBS publish stream đó, hệ thống đẩy tiếp luồng ra YouTube/Facebook bằng FFmpeg worker.</span>
                </div>
                <label>YouTube key<input value={youtubeKey} onChange={(event) => setYoutubeKey(event.target.value)} /></label>
                <label>Facebook key<input value={facebookKey} onChange={(event) => setFacebookKey(event.target.value)} /></label>
                <button className="sw-secondary" disabled={!selectedLiveKey || busy} onClick={() => applyRestream()} type="button">
                  Áp dụng Restream cho stream đang chọn
                </button>
                <label className="sw-check"><input checked={recordEnabled} onChange={(event) => setRecordEnabled(event.target.checked)} type="checkbox" /> Record livestream</label>
                <button disabled={busy} type="submit">{busy ? "Đang xử lý..." : "Tạo stream"}</button>
              </form>
              <div className="sw-note">
                <b>Record lưu ở đâu?</b>
                <span>Nếu tick record, Nginx ghi vào <code>data/records/</code>. Khi OBS dừng, hệ thống convert và đưa bản ghi vào thư viện VOD; vào tab VOD bấm Đồng bộ để xem.</span>
              </div>
              <div className="sw-copy-box">
                <span>OBS Server</span>
                <code>{publishServer}</code>
                <button type="button" onClick={() => copy(publishServer, "OBS server")}>Copy</button>
              </div>
              <div className="sw-copy-box">
                <span>Stream Key</span>
                <code>{selectedLiveKey || "Tạo stream để lấy key"}</code>
                <button disabled={!selectedLiveKey} type="button" onClick={() => copy(selectedLiveKey, "stream key")}>Copy</button>
              </div>
              <div className="sw-note">
                <b>Cách xem live HLS</b>
                <span>Sau khi OBS bấm Start Streaming, chờ khoảng 5-15 giây rồi bấm <b>Làm mới live</b>. Không cần reload cả trang. Nếu Auto chưa có hình, chọn HLS thường hoặc chờ thêm vài giây để adaptive master playlist sinh xong.</span>
              </div>
            </article>

            <article className="sw-panel sw-panel-player">
              <div className="sw-panel-head">
                <div>
                  <h2>Xem live</h2>
                  <p>{selectedLive?.title || selectedLiveKey || "Chưa chọn stream"}</p>
                </div>
                <select value={selectedLiveKey} onChange={(event) => setSelectedLiveKey(event.target.value)}>
                  <option value="">Chọn stream</option>
                  {[...liveStreams, ...streams.filter((stream) => !liveStreams.some((live) => live.streamKey === stream.streamKey))].map((stream) => (
                    <option key={stream.streamKey} value={stream.streamKey}>{stream.title} - {stream.streamKey}</option>
                  ))}
                </select>
                <button type="button" onClick={() => { loadStreams(); loadStats(); }}>
                  Làm mới live
                </button>
              </div>
              <div className="sw-quality">
                {["auto", "240p", "480p", "720p"].map((quality) => (
                  <button className={liveQuality === quality ? "active" : ""} key={quality} onClick={() => setLiveQuality(quality)} type="button">{quality}</button>
                ))}
              </div>
              <div className="sw-note sw-note-compact">
                <span>Auto dùng <code>master.m3u8</code>. Nếu adaptive chưa kịp tạo, player tự thử fallback sang <code>index.m3u8</code>.</span>
              </div>
              <Player fallbackSource={liveFallback} source={liveSource || liveFallback} title="Live player" />
            </article>
          </div>
        ) : null}

        {activePanel === "vod" ? (
          <div className="sw-grid sw-grid-vod">
            <article className="sw-panel">
              <div className="sw-panel-head">
                <h2>Thư viện VOD</h2>
                <button type="button" onClick={() => loadVideos({ sync: true })}>Đồng bộ</button>
              </div>
              <div className="sw-note sw-note-compact">
                <span>Video demo rõ độ phân giải là <code>quality-demo.mp4</code>. Sau khi tạo, bấm Đồng bộ rồi chọn <code>quality-demo</code>.</span>
              </div>
              <div className="sw-list">
                {videos.map((video) => (
                  <button className={selectedVod?.id === video.id ? "sw-list-row selected" : "sw-list-row"} key={video.id} onClick={() => setSelectedVodId(video.id)} type="button">
                    <span>{video.title}</span>
                    <code>{video.fileName}</code>
                  </button>
                ))}
                {!videos.length ? <p className="sw-empty">Chưa có video. Hãy chạy script generate hoặc đồng bộ recording.</p> : null}
              </div>
            </article>
            <article className="sw-panel sw-panel-player">
              <div className="sw-panel-head">
                <div>
                  <h2>{selectedVod?.title || "Chưa chọn VOD"}</h2>
                  <p>{selectedVod?.fileName || "HLS / RTMP playback"}</p>
                </div>
                <button disabled={!selectedVodRtmp} onClick={() => copy(selectedVodRtmp, "RTMP VOD URL")} type="button">Copy RTMP</button>
              </div>
              <div className="sw-quality">
                {vodOptions.map((option) => (
                  <button className={selectedVodOption?.id === option.id ? "active" : ""} key={option.id} onClick={() => setVodQuality(option.id)} type="button">{option.label}</button>
                ))}
              </div>
              <Player source={vodSource} title="VOD player" />
              <div className="sw-copy-box">
                <span>RTMP VLC</span>
                <code>{selectedVodRtmp || "Chưa có URL"}</code>
              </div>
            </article>
          </div>
        ) : null}

        {activePanel === "monitor" ? (
          <div className="sw-grid sw-grid-two">
            <article className="sw-panel">
              <div className="sw-panel-head">
                <h2>RTMP applications</h2>
                <button type="button" onClick={loadStats}>Làm mới</button>
              </div>
              <div className="sw-list">
                {(stats?.applications || []).map((app) => (
                  <div className="sw-stat-card" key={app.name}>
                    <strong>{app.name}</strong>
                    <span>{formatNumber(app.live?.length)} stream</span>
                    {(app.live || []).map((stream) => (
                      <code key={stream.name}>{stream.name} · {formatBandwidth(stream.bandwidthIn)} · clients {stream.nclients}</code>
                    ))}
                  </div>
                ))}
                {!stats?.applications?.length ? <p className="sw-empty">Chưa đọc được Nginx stats hoặc chưa có stream.</p> : null}
              </div>
            </article>
            <article className="sw-panel">
              <h2>Endpoint</h2>
              <div className="sw-copy-box"><span>Stats XML</span><code>{getHlsBaseUrl()}/stat</code></div>
              <div className="sw-copy-box"><span>HLS base</span><code>{getHlsBaseUrl()}</code></div>
            </article>
          </div>
        ) : null}

        {activePanel === "guide" ? (
          <article className="sw-panel">
            <h2>Checklist demo</h2>
            <div className="sw-guide">
              <div><b>1</b><span>Chạy web và Nginx bằng hai terminal.</span></div>
              <div><b>2</b><span>Tạo stream key, copy OBS Server và Stream Key.</span></div>
              <div><b>3</b><span>OBS Windows publish tới <code>{publishServer}</code>.</span></div>
              <div><b>4</b><span>Xem Live, đổi Auto/240p/480p/720p.</span></div>
              <div><b>5</b><span>Dừng OBS, đồng bộ VOD để xem recording.</span></div>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
