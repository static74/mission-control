import { HelperAudioControl } from "./audio-switch";
import type { AudioControl } from "./types";

// One shared instance, mirroring calendar-registry.
let shared: AudioControl | undefined;

export function getAudioControl(): AudioControl {
  return (shared ??= new HelperAudioControl());
}
