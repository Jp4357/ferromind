"use client";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ferromind_token");
    if (!token) {
      window.location.replace("/login/");
    } else {
      setReady(true);
    }
  }, []); // empty — run once on mount only

  if (!ready) return null;
  return <>{children}</>;
}
