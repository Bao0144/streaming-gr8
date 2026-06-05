"use client";

import { useState } from "react";

export default function LoginForm({ users }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Đăng nhập thất bại.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Không thể đăng nhập ở thời điểm hiện tại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label className="field-block">
        <span className="field-label">Tên đăng nhập</span>
        <input
          className="text-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          type="text"
          placeholder={users[0]?.username ? `Ví dụ: ${users[0].username}` : "Nhập username..."}
          autoComplete="username"
        />
      </label>

      <label className="field-block">
        <span className="field-label">Mật khẩu</span>
        <input
          className="text-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Nhập mật khẩu demo..."
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-btn button-reset login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
