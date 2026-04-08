/**
 * Persistence layer — localStorage for browser / Tauri webview.
 * All data is stored as JSON under namespaced keys.
 */

const PREFIX = "reqhub:";

function key(name: string): string {
  return `${PREFIX}${name}`;
}

export function save<T>(name: string, data: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(data));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function remove(name: string): void {
  localStorage.removeItem(key(name));
}
