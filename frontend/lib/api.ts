const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("ferromind_token") || ""
    : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}
