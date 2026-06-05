"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BroadcastIcon,
  PlayIcon,
  PulseIcon,
  StorageIcon
} from "components/system-icons";

const NAV_ITEMS = [
  { target: "top", label: "Dashboard", Icon: PlayIcon },
  { target: "studio", label: "Studio", Icon: BroadcastIcon },
  { target: "vod", label: "VOD", Icon: StorageIcon },
  { target: "stats", label: "Stats", Icon: PulseIcon }
];

export default function GlobalTopBar() {
  const pathname = usePathname();
  const [username, setUsername] = useState("");

  useEffect(() => {
    const cookieValue = document.cookie
      .split("; ")
      .find((item) => item.startsWith("demo_user="))
      ?.split("=")[1];

    setUsername(cookieValue ? decodeURIComponent(cookieValue) : "");
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  function handleNavigate(target) {
    if (pathname !== "/") {
      window.location.href = target === "top" ? "/" : `/#${target}`;
      return;
    }

    if (target === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="global-topbar">
      <div className="global-topbar-row">
        <nav className="global-topbar-nav">
          {NAV_ITEMS.map(({ target, label, Icon }) => (
            <button
              className="global-topbar-link button-reset"
              key={target}
              onClick={() => handleNavigate(target)}
              type="button"
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="global-topbar-user">
          {username ? <span className="global-topbar-user-name">{username}</span> : null}
          <button className="ghost-btn button-reset global-topbar-logout" type="button" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
