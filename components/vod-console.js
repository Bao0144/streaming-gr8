"use client";

import { useEffect, useMemo, useState } from "react";
import { toAbsoluteHlsUrl } from "components/hls-base-url";
import HlsPlayer from "components/hls-player";
import SocialPanel from "components/social-panel";

export default function VodConsole({ currentUser = null }) {
  const [videos, setVideos] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [playMode, setPlayMode] = useState("hls");
  const [copyState, setCopyState] = useState("");
  const [qualityMode, setQualityMode] = useState("auto");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncState, setSyncState] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [brokenPosters, setBrokenPosters] = useState({});

  async function loadLibrary({ sync = false } = {}) {
    setError("");
    if (sync) {
      setIsSyncing(true);
      setSyncState("Đang quét thư mục local và cập nhật thư viện...");
    }

    try {
      const response = await fetch(`/api/vod/library${sync ? "?sync=1" : ""}`, {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Không thể tải thư viện VOD.");
        return;
      }

      setVideos(data.videos || []);
      setBrokenPosters({});
      setSyncState(sync ? "Đã đồng bộ thư viện từ thư mục local." : "");
      if ((data.videos || []).length > 0) {
        setSelectedId((current) => current || data.videos[0].id);
      }
    } catch {
      setError("Không thể tải thư viện VOD.");
    } finally {
      if (sync) {
        setIsSyncing(false);
      }
    }
  }

  useEffect(() => {
    loadLibrary({ sync: false });
  }, []);

  useEffect(() => {
    document.body.classList.add("vod-route-body");
    return () => {
      document.body.classList.remove("vod-route-body");
    };
  }, []);

  const filteredVideos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return videos;
    }

    return videos.filter((video) =>
      `${video.title} ${video.fileName}`.toLowerCase().includes(normalized)
    );
  }, [query, videos]);

  const selectedVideo = filteredVideos.find((video) => video.id === selectedId)
    || videos.find((video) => video.id === selectedId)
    || filteredVideos[0]
    || null;

  const qualityOptions = selectedVideo?.hlsPlayback?.options || [
    {
      id: "standard",
      label: "Chuẩn",
      path: selectedVideo?.hlsUrl
    }
  ];

  const selectedQuality = qualityOptions.find((option) => option.id === qualityMode)
    || qualityOptions[0]
    || null;
  const canDeleteSelectedVideo = Boolean(
    selectedVideo
    && currentUser
    && (currentUser.username === "admin" || selectedVideo.ownerUserId === currentUser.id)
  );

  useEffect(() => {
    if (!selectedVideo && filteredVideos.length > 0) {
      setSelectedId(filteredVideos[0].id);
    }
  }, [filteredVideos, selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) {
      return;
    }

    const nextMode = selectedVideo.hlsPlayback?.hasAdaptive ? "auto" : "standard";
    setQualityMode((current) => {
      const stillValid = qualityOptions.some((option) => option.id === current);
      return stillValid ? current : nextMode;
    });
  }, [selectedVideo, qualityOptions]);

  async function copyRtmpUrl() {
    if (!selectedVideo) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedVideo.rtmpUrl);
      setCopyState("Đã sao chép RTMP URL.");
    } catch {
      setCopyState("Không thể sao chép RTMP URL.");
    }
  }

  async function handleDeleteSelectedVideo() {
    if (!selectedVideo?.fileName) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/vod/library", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: selectedVideo.fileName
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Không thể xóa video.");
        return;
      }

      const removedId = selectedVideo.id;
      await loadLibrary({ sync: false });
      setSelectedId((current) => (current === removedId ? "" : current));
      setSyncState("Đã xóa video khỏi thư viện.");
    } catch {
      setError("Không thể xóa video.");
    } finally {
      setIsDeleting(false);
    }
  }

  function markPosterBroken(videoId) {
    setBrokenPosters((current) => {
      if (current[videoId]) {
        return current;
      }

      return {
        ...current,
        [videoId]: true
      };
    });
  }

  return (
    <div className="vod-page-shell">
      <section className="vod-console-layout vod-console-frame">
        <div className="vod-main-column">
          <section className="vod-stage">
            <div className="vod-stage-actions">
              <div className="vod-mode-switch">
                <button
                  className={`vod-mode-btn button-reset${playMode === "hls" ? " vod-mode-btn-active" : ""}`}
                  type="button"
                  onClick={() => setPlayMode("hls")}
                >
                  Xem bằng HLS
                </button>
                <button
                  className={`vod-mode-btn button-reset${playMode === "rtmp" ? " vod-mode-btn-active" : ""}`}
                  type="button"
                  onClick={() => setPlayMode("rtmp")}
                >
                  Xem bằng RTMP
                </button>
              </div>
            </div>

            {selectedVideo ? (
              <>
                {playMode === "hls" ? (
                  <>
                    <div className="vod-player-region">
                      <HlsPlayer
                        key={`${selectedVideo.id}-${selectedQuality?.id || "standard"}-hls`}
                        sourcePath={selectedQuality?.path || selectedVideo.hlsUrl}
                        title={selectedVideo.title}
                        hideStatus
                        fitContainer
                      />
                    </div>
                  </>
                ) : (
                  <div className="vod-rtmp-stage vod-player-region">
                    <div className="vod-rtmp-frame">
                      <div className="vod-rtmp-overlay">
                        <p className="eyebrow">RTMP Playback</p>
                        <h2>Mở bằng VLC hoặc player hỗ trợ RTMP</h2>
                        <div className="command-block">
                          <code>{selectedVideo.rtmpUrl}</code>
                        </div>
                        <div className="hero-actions compact-actions">
                          <button className="primary-btn button-reset" type="button" onClick={copyRtmpUrl}>
                            Sao chép RTMP URL
                          </button>
                          <a className="ghost-btn" href={selectedVideo.rtmpUrl}>
                            Mở giao thức RTMP
                          </a>
                          {canDeleteSelectedVideo ? (
                            <button
                              className="ghost-btn button-reset danger-btn"
                              type="button"
                              onClick={handleDeleteSelectedVideo}
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Đang xóa..." : "Xóa video"}
                            </button>
                          ) : null}
                        </div>
                        {copyState ? <p className="player-status">{copyState}</p> : null}
                      </div>
                    </div>
                  </div>
                )}
                <div className="vod-below-stack">
                  <div className="vod-meta-panel vod-meta-inline">
                    <div className="vod-title-stack">
                      <div className="vod-title-row">
                        {selectedVideo.authorDisplayName ? (
                          <span className="status-pill vod-author-badge">
                            Tác giả: {selectedVideo.authorDisplayName}
                          </span>
                        ) : null}
                        {selectedVideo.isArchive ? (
                          <span className="status-pill status-live vod-origin-badge">
                            {selectedVideo.archiveMeta?.label || "Archive"}
                          </span>
                        ) : null}
                        <h1 className="vod-title">{selectedVideo.title}</h1>
                      </div>
                    </div>
                    {playMode === "hls" ? (
                      <div className="quality-switch vod-quality-switch-inline">
                        {qualityOptions.map((option) => (
                          <button
                            key={option.id}
                            className={`quality-btn button-reset${selectedQuality?.id === option.id ? " quality-btn-active" : ""}`}
                            type="button"
                            onClick={() => setQualityMode(option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {playMode === "hls" && canDeleteSelectedVideo ? (
                      <button
                        className="ghost-btn button-reset small-btn danger-btn"
                        type="button"
                        onClick={handleDeleteSelectedVideo}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Đang xóa..." : "Xóa video"}
                      </button>
                    ) : null}
                  </div>

                  <SocialPanel
                    contentType="vod"
                    contentId={selectedVideo.id}
                  />
                </div>
              </>
            ) : (
              <p className="empty-text">Chưa có video VOD nào trong thư viện.</p>
            )}
          </section>

        </div>

        <aside className="vod-side-column">
          <div className="vod-sidebar-head">
            <div>
              <p className="eyebrow">Danh sách phát</p>
              <h2>Hàng đợi</h2>
            </div>
            <span className="status-pill status-live">{filteredVideos.length} video</span>
          </div>

          <div className="vod-search-row">
            <label className="field-block vod-search-field">
              <span className="field-label">Tìm kiếm video</span>
              <input
                className="text-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nhập tên video..."
              />
            </label>
            <button
              className="ghost-btn button-reset vod-refresh-btn"
              type="button"
              onClick={() => loadLibrary({ sync: true })}
              disabled={isSyncing}
            >
              {isSyncing ? "Đang đồng bộ..." : "Làm mới thư viện"}
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {!error && syncState ? <p className="player-status">{syncState}</p> : null}

          <div className="vod-queue-list">
            {filteredVideos.length === 0 ? (
              <p className="empty-text">Không tìm thấy video phù hợp.</p>
            ) : (
              filteredVideos.map((video, index) => (
                <button
                  key={video.id}
                  className={`vod-queue-item button-reset${selectedVideo?.id === video.id ? " vod-queue-item-active" : ""}`}
                  type="button"
                  onClick={() => setSelectedId(video.id)}
                >
                  <div className="vod-queue-thumb">
                    {video.posterUrl && !brokenPosters[video.id] ? (
                      <img
                        className="vod-queue-thumb-image"
                        src={toAbsoluteHlsUrl(video.posterUrl)}
                        alt={video.title}
                        onError={() => markPosterBroken(video.id)}
                      />
                    ) : (
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="vod-queue-meta">
                    {video.authorDisplayName ? (
                      <span className="status-pill vod-author-badge vod-author-badge-compact">
                        Tác giả: {video.authorDisplayName}
                      </span>
                    ) : null}
                    {video.isArchive ? (
                      <span className="status-pill status-live vod-origin-badge vod-origin-badge-compact">
                        {video.archiveMeta?.label || "Archive"}
                      </span>
                    ) : null}
                    <div className="stream-title">{video.title}</div>
                    <div className="recording-meta">
                      <span>{video.updatedAt}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
