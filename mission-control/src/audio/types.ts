/** A selectable audio output device. `uid` is the stable CoreAudio identifier. */
export interface AudioOutput {
  uid: string;
  name: string;
}

/** The seam over the bundled helper. Injectable; mac-only at runtime. */
export interface AudioControl {
  current(): Promise<AudioOutput | null>; // null when unknown (read failed / non-darwin)
  setOutput(target: string): Promise<AudioOutput | null>; // returns the device ACTUALLY current after the attempt
  list(): Promise<AudioOutput[]>;
}

// Provisional defaults (sourced from system_profiler, confirmed against `audio-switch list`).
// Used only when the setting is empty.
export const DEFAULT_NORMAL_DEVICE = "Benchmark 1.0";
export const DEFAULT_MEETING_DEVICE = "Dell U4924DW";
