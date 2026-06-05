"use client";

const CONFIGURED_HLS_BASE_URL = process.env.NEXT_PUBLIC_HLS_BASE_URL || "";
const DEFAULT_HLS_PORT = process.env.NEXT_PUBLIC_HLS_PORT || "8080";

export function getHlsBaseUrl() {
  if (CONFIGURED_HLS_BASE_URL) {
    return CONFIGURED_HLS_BASE_URL;
  }

  if (typeof window === "undefined") {
    return `http://localhost:${DEFAULT_HLS_PORT}`;
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_HLS_PORT}`;
}

export function toAbsoluteHlsUrl(path) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (url.hostname !== "localhost" || typeof window === "undefined") {
        return path;
      }

      return `${getHlsBaseUrl()}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return path;
    }
  }

  return `${getHlsBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
