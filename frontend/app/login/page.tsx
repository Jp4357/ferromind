"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Please enter your credentials."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem("ferromind_token", token);
        router.push("/");
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch {
      setError("Cannot connect to server. Check your connection.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0c0f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Ambient amber glow */}
      <div style={{
        position: "absolute",
        width: 700, height: 700,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(240,165,0,0.07) 0%, transparent 65%)",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: [
          "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "44px 44px",
        pointerEvents: "none",
      }} />

      {/* Corner marks */}
      {[
        { top: 24, left: 24 },
        { top: 24, right: 24 },
        { bottom: 24, left: 24 },
        { bottom: 24, right: 24 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos,
          width: 20, height: 20,
          borderTop:  i < 2 ? "1px solid rgba(240,165,0,0.2)" : undefined,
          borderBottom: i >= 2 ? "1px solid rgba(240,165,0,0.2)" : undefined,
          borderLeft:  i % 2 === 0 ? "1px solid rgba(240,165,0,0.2)" : undefined,
          borderRight: i % 2 === 1 ? "1px solid rgba(240,165,0,0.2)" : undefined,
        }} />
      ))}

      {/* Login card */}
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#1a2030",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        padding: "40px 36px 32px",
        position: "relative",
        boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(240,165,0,0.04)",
        animation: "loginFadeIn 0.45s ease",
        margin: "0 16px",
      }}>

        {/* Top accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 10%, #f0a500 40%, #e05c2a 60%, transparent 90%)",
          borderRadius: "16px 16px 0 0",
        }} />

        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #f0a500, #e05c2a)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 10px 30px rgba(240,165,0,0.28), 0 0 0 1px rgba(240,165,0,0.15)",
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L24 7.5V20.5L14 26L4 20.5V7.5L14 2Z" fill="none" stroke="#0a0c0f" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M14 7L19 9.75V15.25L14 18L9 15.25V9.75L14 7Z" fill="#0a0c0f" fillOpacity="0.6"/>
              <circle cx="14" cy="12.5" r="2" fill="#0a0c0f"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 24, fontWeight: 700,
            color: "#e8ecf0", letterSpacing: "-0.4px", marginBottom: 6,
          }}>
            FerroMind
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, color: "#6b7a8d",
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            Ferrochrome Intelligence System
          </p>
        </div>

        {/* Divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          marginBottom: 28,
        }} />

        {/* Sign in label */}
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11, color: "#6b7a8d",
          textTransform: "uppercase", letterSpacing: "0.1em",
          marginBottom: 20,
        }}>
          Sign in to continue
        </p>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Username field */}
          <div>
            <label style={{
              display: "block",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, color: "#6b7a8d",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 7,
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              style={{
                width: "100%", padding: "11px 14px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${error ? "rgba(232,82,74,0.4)" : "rgba(255,255,255,0.09)"}`,
                borderRadius: 8,
                color: "#e8ecf0",
                fontFamily: "'DM Mono', monospace", fontSize: 13,
                outline: "none", transition: "border-color 0.18s, box-shadow 0.18s",
              }}
              onFocus={e => {
                e.target.style.borderColor = "rgba(240,165,0,0.5)";
                e.target.style.boxShadow   = "0 0 0 3px rgba(240,165,0,0.08)";
              }}
              onBlur={e => {
                e.target.style.borderColor = error ? "rgba(232,82,74,0.4)" : "rgba(255,255,255,0.09)";
                e.target.style.boxShadow   = "none";
              }}
            />
          </div>

          {/* Password field */}
          <div>
            <label style={{
              display: "block",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, color: "#6b7a8d",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 7,
            }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "11px 44px 11px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${error ? "rgba(232,82,74,0.4)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 8,
                  color: "#e8ecf0",
                  fontFamily: "'DM Mono', monospace", fontSize: 13,
                  outline: "none", transition: "border-color 0.18s, box-shadow 0.18s",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "rgba(240,165,0,0.5)";
                  e.target.style.boxShadow   = "0 0 0 3px rgba(240,165,0,0.08)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = error ? "rgba(232,82,74,0.4)" : "rgba(255,255,255,0.09)";
                  e.target.style.boxShadow   = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#6b7a8d", padding: 0, lineHeight: 1,
                  fontSize: 14, display: "flex", alignItems: "center",
                }}
              >
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: "rgba(232,82,74,0.07)",
              border: "1px solid rgba(232,82,74,0.22)",
              borderRadius: 6, padding: "9px 12px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11, color: "#e8524a",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>✗</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: "13px",
              background: loading
                ? "rgba(240,165,0,0.1)"
                : "linear-gradient(135deg, rgba(240,165,0,0.92), rgba(224,92,42,0.88))",
              border: "1px solid rgba(240,165,0,0.3)",
              borderRadius: 8,
              color: loading ? "#f0a500" : "#0a0c0f",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading ? 0.75 : 1,
              boxShadow: loading ? "none" : "0 4px 20px rgba(240,165,0,0.2)",
            }}
          >
            {loading ? "Authenticating…" : "Sign In  →"}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(107,122,141,0.45)" }}>
            Secure access
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(107,122,141,0.45)" }}>
            FerroMind v2.0
          </span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0c0f; }
        input::placeholder { color: rgba(107,122,141,0.45); }
        @keyframes loginFadeIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
