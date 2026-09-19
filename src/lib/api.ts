const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Request failed");
  }
  return res.json();
}

export const api = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: <T = any>(path: string) => request(path) as Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = any>(path: string, body?: unknown) => request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }) as Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T = any>(path: string, body?: unknown) => request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }) as Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: <T = any>(path: string) => request(path, { method: "DELETE" }) as Promise<T>,
};
