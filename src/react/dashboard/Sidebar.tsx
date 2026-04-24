import { useState } from "react";

import { NAV, S } from "./constants";
import type { Page } from "./types";

export function Sidebar({
  activePage,
  onNavigate,
}: {
  activePage: Page;
  onNavigate: (p: Page) => void;
}) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background:
          "linear-gradient(180deg, #101828 0%, #132033 55%, #10243a 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 10px 24px rgba(15,118,110,0.3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="7" width="3" height="6" rx="1" fill="white" />
            <rect x="5.5" y="4" width="3" height="9" rx="1" fill="white" />
            <rect x="10" y="1" width="3" height="12" rx="1" fill="white" />
          </svg>
        </div>
        <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>
          Analytics
        </span>
      </div>

      <nav style={{ flex: 1, padding: "10px 0" }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activePage === item.id}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div
        style={{
          padding: "14px 20px",
          fontSize: 11,
          color: "#6f8098",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        Powered by Convex Analytics
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: (p: Page) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 20px",
        border: "none",
        borderLeft: `3px solid ${active ? S.sidebarActiveBorder : "transparent"}`,
        background: active || hovered ? S.sidebarActiveBg : "transparent",
        color: active ? S.sidebarActiveText : hovered ? "#cbd5e1" : S.sidebarText,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        textAlign: "left",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}
