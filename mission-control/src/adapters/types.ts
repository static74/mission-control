export type AdapterStatus = "ok" | "no-config" | "unavailable";

export interface Snapshot<T> {
  status: AdapterStatus;
  value: T | null;
  fetchedAt: number;
  stale: boolean;
}

export interface SourceAdapter<T> {
  start(): void;
  stop(): void;
  latest(): Snapshot<T>;
  onChange(cb: (s: Snapshot<T>) => void): void;
}
