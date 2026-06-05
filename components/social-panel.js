"use client";

import { useEffect, useState } from "react";

function formatCommentTime(value) {
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

export default function SocialPanel({
  contentType,
  contentId,
  compact = false,
  mode = "default",
  pollingMs = 0
}) {
  const [social, setSocial] = useState({
    likeCount: 0,
    likedByMe: false,
    comments: [],
    currentUser: null
  });
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isChatMode = mode === "chat";

  async function loadSocial({ silent = false } = {}) {
    if (!contentType || !contentId) {
      return;
    }

    setError("");
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(
        `/api/social?contentType=${encodeURIComponent(contentType)}&contentId=${encodeURIComponent(contentId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Không thể tải tương tác.");
        return;
      }
      setSocial(data);
    } catch {
      setError("Không thể tải tương tác.");
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadSocial();
  }, [contentType, contentId]);

  useEffect(() => {
    if (!pollingMs || pollingMs < 1000 || !contentType || !contentId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadSocial({ silent: true });
    }, pollingMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [contentType, contentId, pollingMs]);

  async function handleToggleLike() {
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-like",
          contentType,
          contentId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Không thể cập nhật lượt thích.");
        return;
      }
      setSocial((current) => ({ ...current, ...data }));
    } catch {
      setError("Không thể cập nhật lượt thích.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    const trimmed = commentBody.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          contentType,
          contentId,
          body: trimmed
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Không thể gửi bình luận.");
        return;
      }
      setSocial((current) => ({ ...current, ...data }));
      setCommentBody("");
    } catch {
      setError("Không thể gửi bình luận.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`social-panel${compact ? " social-panel-compact" : ""}${isChatMode ? " social-panel-chat" : ""}`}>
      <div className="social-panel-head">
        <div>
          <p className="eyebrow">{isChatMode ? "Realtime chat" : "Tương tác"}</p>
          <h2>{isChatMode ? "Bình luận trực tiếp" : "Like & comment"}</h2>
        </div>
        {isChatMode ? (
          <span className="status-pill status-live social-live-pill">
            {social.comments?.length || 0} tin
          </span>
        ) : (
          <button
            className={`ghost-btn button-reset social-like-btn${social.likedByMe ? " social-like-btn-active" : ""}`}
            type="button"
            onClick={handleToggleLike}
            disabled={isSubmitting || isLoading}
          >
            {social.likedByMe ? "Đã thích" : "Like"} · {social.likeCount}
          </button>
        )}
      </div>

      <form className="social-comment-form" onSubmit={handleCommentSubmit}>
        <textarea
          className="text-input social-comment-input"
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder={isChatMode ? "Nhập tin nhắn..." : "Viết bình luận..."}
          rows={isChatMode ? 2 : compact ? 2 : 3}
        />
        <div className="social-comment-actions">
          <span className="social-current-user">
            {social.currentUser ? `Đăng nhập: ${social.currentUser.displayName}` : ""}
          </span>
          <button className="ghost-btn social-send-btn button-reset small-btn" type="submit" disabled={isSubmitting || !commentBody.trim()}>
            Gửi bình luận
          </button>
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {!error && isLoading ? <p className="player-status">Đang tải tương tác...</p> : null}

      <div className={`social-comments-list${isChatMode ? " social-comments-list-chat" : ""}`}>
        {social.comments?.length ? (
          social.comments.map((comment) => {
            const isOwnComment = Boolean(
              social.currentUser?.username
              && comment.username === social.currentUser.username
            );

            return (
            <article
              className={`social-comment-item${isChatMode ? " social-comment-item-chat" : ""}${isOwnComment ? " social-comment-item-own" : ""}`}
              key={comment.id}
            >
              <div className="social-comment-meta">
                <div className="social-comment-author">
                  <strong>{comment.displayName}</strong>
                  <span className="social-comment-username">@{comment.username}</span>
                  {isOwnComment ? <em className="social-comment-badge">Bạn</em> : null}
                </div>
                <span>{formatCommentTime(comment.createdAt)}</span>
              </div>
              <p>{comment.body}</p>
            </article>
            );
          })
        ) : (
          !isLoading && <p className="empty-text">Chưa có bình luận nào.</p>
        )}
      </div>
    </section>
  );
}
