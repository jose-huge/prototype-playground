"use client";

import { useState, useEffect } from "react";
import Playground from "./Playground";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone } from "lucide-react";

const MENU_BAR_H = 28;

function formatMenuBarTime(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const day = days[date.getDay()];
  const month = months[date.getMonth()];
  const dateNum = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${day}, ${month} ${dateNum}  ${hour12}:${minutes} ${ampm}`;
}

function AppleIcon() {
  return (
    <svg width="12" height="15" viewBox="0 0 12 15" fill="currentColor" aria-hidden="true">
      <path d="M10.09 8.12C10.08 6.36 11.5 5.5 11.56 5.46C10.73 4.22 9.42 4.05 8.96 4.03C7.86 3.92 6.79 4.69 6.23 4.69C5.66 4.69 4.8 4.04 3.88 4.06C2.68 4.08 1.56 4.78 0.95 5.86C-0.33 8.06 0.62 11.32 1.84 13.1C2.46 13.98 3.19 14.96 4.17 14.93C5.12 14.9 5.49 14.33 6.64 14.33C7.78 14.33 8.13 14.93 9.12 14.9C10.15 14.88 10.78 14.02 11.38 13.13C12.09 12.1 12.37 11.1 12.38 11.05C12.36 11.04 10.1 10.19 10.09 8.12Z" />
      <path d="M8.25 2.75C8.74 2.15 9.07 1.32 8.98 0.5C8.27 0.53 7.39 0.97 6.88 1.56C6.43 2.09 6.03 2.94 6.14 3.75C6.93 3.81 7.74 3.35 8.25 2.75Z" />
    </svg>
  );
}


type View = "desktop" | "playground";

type Viewport = "desktop" | "tablet" | "mobile";


const DEFAULT_PROJECT_NAME = "Prototype Playground";

export default function VirtualDesktop() {
  const [view, setView] = useState<View>("desktop");
  const [openSettingsOnMount, setOpenSettingsOnMount] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [menuBarTime, setMenuBarTime] = useState(() => formatMenuBarTime(new Date()));
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);

  // Sync project name from localStorage (set by Playground Settings)
  useEffect(() => {
    const read = () => {
      const saved = localStorage.getItem("playground-project-name");
      setProjectName(saved || DEFAULT_PROJECT_NAME);
    };
    // Custom event: fired same-tab when Settings saves (storage event is cross-tab only)
    const onCustom = (e: CustomEvent) => setProjectName(e.detail || DEFAULT_PROJECT_NAME);
    read();
    window.addEventListener("storage", read);
    window.addEventListener("playground:project-name", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("playground:project-name", onCustom as EventListener);
    };
  }, []);

  useEffect(() => {
    const ww = window.innerWidth * 0.85;
    const wh = window.innerHeight * 0.80;
    const available = window.innerHeight - MENU_BAR_H;
    setPos({
      x: (window.innerWidth - ww) / 2,
      y: Math.max(0, (available - wh) / 2),
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    const tick = () => setMenuBarTime(formatMenuBarTime(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const onTitleBarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = pos.x;
    const startPosY = pos.y;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      setPos({
        x: startPosX + (ev.clientX - startMouseX),
        y: startPosY + (ev.clientY - startMouseY),
      });
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Menu bar — only shown in desktop view */}
      {view === "desktop" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${MENU_BAR_H}px`,
            backgroundColor: "rgba(11, 5, 3, 0.4)",
            backdropFilter: "blur(var(--blur-glass))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 var(--space-200)",
            zIndex: 50,
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 400,
            color: "#ffffff",
            userSelect: "none",
          }}
        >
          {/* Left: Apple logo (toggle), app name, menu items */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-300)" }}>
            <button
              onClick={() => setView("playground")}
              title="Switch to Prototype Playground"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                padding: "2px 5px",
                borderRadius: "4px",
                transition: "background 150ms ease",
              }}
            >
              <AppleIcon />
            </button>
            <span style={{ fontWeight: 500 }}>{projectName}</span>
            {["File", "Edit", "View", "Window", "Help"].map((item) => (
              <span
                key={item}
                style={{ opacity: 0.85, cursor: "default", whiteSpace: "nowrap" }}
              >
                {item}
              </span>
            ))}
          </div>

          {/* Right: clock */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-200)" }}>
            <span style={{ opacity: 0.9, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
              {menuBarTime}
            </span>
          </div>
        </div>
      )}

      {/* Content area — full viewport in prototype view, below menu bar in desktop view */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {view !== "desktop" ? (
          <Playground view={view} onNavigate={setView} openSettings={openSettingsOnMount} />
        ) : (
          /* Website view: gradient desktop + floating browser + taskbar */
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              background: `
              radial-gradient(ellipse at 20% 30%, rgba(255,0,150,0.6) 0%, transparent 55%),
              radial-gradient(ellipse at 75% 65%, rgba(255,0,120,0.35) 0%, transparent 50%),
              radial-gradient(ellipse at 60% 10%, rgba(255,255,255,0.2) 0%, transparent 40%),
              radial-gradient(ellipse at 45% 90%, rgba(255,20,100,0.3) 0%, transparent 45%),
              #0a0a0a
            `.replace(/\s+/g, " ").trim(),
            }}
          >
            {/* Floating browser window */}
            {visible && (
              <div
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: "85vw",
                  height: "80vh",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-2xl)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Title bar */}
                <div
                  onMouseDown={onTitleBarMouseDown}
                  style={{
                    position: "relative",
                    height: "36px",
                    backgroundColor: "#F2F2F2",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 var(--space-200)",
                    cursor: "grab",
                    flexShrink: 0,
                    userSelect: "none",
                  }}
                >
                  {/* Traffic lights + nav arrows */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-150)", zIndex: 1 }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28C840" }} />
                    </div>
                    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                      <span style={{ color: "#858281", fontSize: "18px", lineHeight: 1, fontFamily: "system-ui", padding: "0 2px" }}>‹</span>
                      <span style={{ color: "#B5B4B3", fontSize: "18px", lineHeight: 1, fontFamily: "system-ui", padding: "0 2px" }}>›</span>
                    </div>
                  </div>

                  {/* URL bar — centered */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      transform: "translateX(-50%)",
                      height: "22px",
                      backgroundColor: "#ffffff",
                      borderRadius: "var(--radius-round)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      color: "#54504E",
                      fontFamily: "var(--font-sans)",
                      border: "1px solid var(--color-border)",
                      padding: "0 var(--space-400)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {projectName.toLowerCase().replace(/\s+/g, "-")}.com
                  </div>

                  {/* Viewport switcher — right side */}
                  <div style={{ marginLeft: "auto", zIndex: 1 }}>
                    <ButtonGroup aria-label="Viewport size">
                      <Button
                        variant={viewport === "desktop" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewport("desktop")}
                      >
                        <Monitor size={14} />
                      </Button>
                      <Button
                        variant={viewport === "tablet" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewport("tablet")}
                      >
                        <Tablet size={14} />
                      </Button>
                      <Button
                        variant={viewport === "mobile" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewport("mobile")}
                      >
                        <Smartphone size={14} />
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>

                {/* Browser content */}
                <div style={{ flex: 1, overflow: "hidden", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "32px",
                    textAlign: "center",
                    padding: "0 32px",
                    userSelect: "none",
                  }}>
                    {/* Logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/huge-logo.png"
                      alt="Huge"
                      style={{ width: "150px", height: "auto", opacity: 0.9 }}
                    />

                    {/* Eyebrow */}
                    <span style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "11px",
                      fontWeight: 400,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.35)",
                    }}>
                      Version 1.0
                    </span>

                    {/* Headline */}
                    <h1 style={{
                      margin: 0,
                      fontFamily: "var(--font-sans)",
                      fontSize: "clamp(2rem, 5vw, 3.5rem)",
                      fontWeight: 300,
                      lineHeight: 1.05,
                      letterSpacing: "-0.03em",
                      color: "#ffffff",
                    }}>
                      Prototype Playground
                    </h1>

                    {/* CTA */}
                    <button
                      onClick={() => { setOpenSettingsOnMount(true); setView("playground"); }}
                      style={{
                        marginTop: "8px",
                        padding: "14px 36px",
                        borderRadius: "9999px",
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#ffffff",
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        cursor: "pointer",
                        transition: "background 200ms ease, border-color 200ms ease",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.35)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)";
                      }}
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
