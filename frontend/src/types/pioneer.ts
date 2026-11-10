/**
 * Pioneer AVR State and Command Type Definitions.
 *
 * Defines core interfaces and helper functions for interacting with Pioneer AV receivers
 * over RS-232 and TCP/IP (Telnet port 23 or 8102) protocol formats.
 */

/**
 * Aggregated status snapshot of the Pioneer AV receiver.
 *
 * Represents the current operational telemetry queried from the receiver or received
 * via real-time WebSocket status broadcasts from the backend service.
 */
export interface AmplifierStatus {
  /**
   * Main zone power state.
   * `true` indicates the unit is powered ON; `false` indicates STANDBY.
   */
  power: boolean;

  /**
   * Current master volume level.
   * May be represented as a raw integer (0–161), a numeric string ("80"),
   * or a Pioneer protocol response string (e.g., "VOL080").
   */
  volume: string | number;

  /**
   * Main zone audio mute status.
   * `true` indicates audio output is muted; `false` indicates unmuted.
   */
  muted: boolean;

  /**
   * Active input source identifier or command code (e.g., "19" or "FN19" for HDMI 1).
   */
  input: string;

  /**
   * Indicator of whether the backend service currently maintains an active TCP/IP
   * connection to the physical Pioneer receiver.
   */
  connected: boolean;

  /**
   * Optional human-readable error or warning message detailing any connection
   * dropouts, socket timeouts, or protocol communication failures.
   */
  error?: string;
}

/**
 * Standard API response envelope returned by backend Pioneer AVR command endpoints.
 */
export interface CommandResponse {
  /**
   * Indicates whether the command was dispatched and executed successfully.
   */
  success: boolean;

  /**
   * Human-readable description of the operation result (e.g., "Volume set to 80").
   */
  message: string;

  /**
   * Optional raw ASCII response received from the Pioneer receiver hardware
   * (e.g., "VOL080", "PWR0", "MUT0"), or `null` if no response was expected.
   */
  response?: string | null;
}

/**
 * Metadata configuration for an AV receiver input source preset.
 */
export interface InputPreset {
  /**
   * Unique identifier key used for component rendering and dictionary lookups.
   */
  id: string;

  /**
   * Primary human-readable display label (e.g., "HDMI 1", "BD", "TV / SAT").
   */
  label: string;

  /**
   * Two-digit Pioneer input function code without the "FN" suffix (e.g., "19" for HDMI 1).
   * Appended to "FN" when sending commands to the receiver hardware.
   */
  code: string;

  /**
   * Category classification for UI grouping and styling.
   */
  category: 'hdmi' | 'media' | 'audio' | 'network' | 'custom';

  /**
   * Lucide icon identifier representing this input device in the remote interface.
   */
  iconName: 'Tv' | 'Disc' | 'Gamepad2' | 'Radio' | 'Music' | 'Wifi' | 'Cast' | 'Cable' | 'Sliders';

  /**
   * Optional secondary description indicating typical connected devices (e.g., "BD / DVD").
   */
  description?: string;
}

/**
 * Catalog of predefined audio/video inputs with Pioneer function code mappings.
 *
 * Maps two-digit Pioneer function codes (e.g., "19" for HDMI 1, "25" for BD) to UI icons,
 * labels, and categories according to Pioneer VSX/SC series specifications.
 */
export const INPUT_PRESETS: InputPreset[] = [
  { id: 'hdmi1', label: 'HDMI 1', code: '19', category: 'hdmi', iconName: 'Cable', description: 'BD / DVD' },
  { id: 'hdmi2', label: 'HDMI 2', code: '20', category: 'hdmi', iconName: 'Gamepad2', description: 'Console / Gaming' },
  { id: 'hdmi3', label: 'HDMI 3', code: '21', category: 'hdmi', iconName: 'Tv', description: 'Streaming Box' },
  { id: 'hdmi4', label: 'HDMI 4', code: '22', category: 'hdmi', iconName: 'Tv', description: 'Aux HDMI' },
  { id: 'hdmi5', label: 'HDMI 5', code: '23', category: 'hdmi', iconName: 'Cable', description: 'Front / Aux' },
  { id: 'bd', label: 'BD', code: '25', category: 'media', iconName: 'Disc', description: 'Blu-ray' },
  { id: 'dvd', label: 'DVD', code: '04', category: 'media', iconName: 'Disc', description: 'DVD Player' },
  { id: 'tv', label: 'TV / SAT', code: '05', category: 'media', iconName: 'Tv', description: 'TV Audio / Arc' },
  { id: 'sat', label: 'SAT / CBL', code: '06', category: 'media', iconName: 'Tv', description: 'Satellite / Cable' },
  { id: 'cd', label: 'CD', code: '01', category: 'audio', iconName: 'Disc', description: 'CD Player' },
  { id: 'phono', label: 'Phono', code: '00', category: 'audio', iconName: 'Music', description: 'Turntable' },
  { id: 'tuner', label: 'Tuner', code: '02', category: 'audio', iconName: 'Radio', description: 'AM / FM Radio' },
  { id: 'bt', label: 'Bluetooth', code: '33', category: 'network', iconName: 'Cast', description: 'BT Audio' },
  { id: 'net', label: 'Net Radio', code: '38', category: 'network', iconName: 'Wifi', description: 'Internet Radio' },
  { id: 'spotify', label: 'Spotify', code: '45', category: 'network', iconName: 'Music', description: 'Spotify Connect' },
  { id: 'airplay', label: 'AirPlay', code: '44', category: 'network', iconName: 'Cast', description: 'Apple AirPlay' },
];

/**
 * Extracts a numeric volume integer from various Pioneer volume representations.
 *
 * Supports raw numbers (e.g., `80`), string numbers (e.g., `"80"`), or Pioneer
 * protocol response strings (e.g., `"VOL080"`).
 *
 * @param val - The raw volume value from API or WebSocket payload.
 * @returns The parsed numeric volume level (0-161), or `0` if invalid or undefined.
 *
 * @example
 * ```ts
 * parseVolumeNumber("VOL080"); // Returns 80
 * parseVolumeNumber("42");     // Returns 42
 * parseVolumeNumber(100);      // Returns 100
 * parseVolumeNumber(undefined);// Returns 0
 * ```
 */
export function parseVolumeNumber(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Match one or more contiguous digits in the input string (e.g., extracting "080" from "VOL080")
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Converts a Pioneer raw volume integer (0–161) to a human-readable decibel (dB) string.
 *
 * Pioneer AVR units use a 0.5 dB step scale:
 * - `0` represents minimum volume (cutoff/mute floor), formatted as `"-∞ dB"`.
 * - `1` represents `-80.0 dB`.
 * - `145` represents reference level `0.0 dB`.
 * - `161` represents maximum volume `+12.0 dB`.
 *
 * Formula: `dB = (volume - 161) * 0.5 + 12.0`
 *
 * @param volume - Pioneer raw volume level in the range 0 to 161.
 * @returns Formatted decibel string with sign and unit (e.g., `"+12.0 dB"`, `"-25.5 dB"`, or `"-\u221E dB"`).
 *
 * @example
 * ```ts
 * volumeToDecibels(0);   // "-\u221E dB" (-Infinity dB)
 * volumeToDecibels(145); // "0.0 dB"
 * volumeToDecibels(161); // "+12.0 dB"
 * volumeToDecibels(121); // "-20.0 dB"
 * ```
 */
export function volumeToDecibels(volume: number): string {
  // Volume at or below 0 is treated as infinite attenuation / mute level
  if (volume <= 0) return '-\u221E dB';
  // Compute decibels using Pioneer linear 0.5 dB step mapping against maximum (+12 dB at raw 161)
  const db = (volume - 161) * 0.5 + 12.0;
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/**
 * Formats a Pioneer input function code into a human-readable display label.
 *
 * Strips leading "FN" prefixes if present (e.g., `"FN19"` -> `"19"`), then matches
 * against the known `INPUT_PRESETS` list. If unmatched, falls back to `"Input <code\>"`.
 *
 * @param code - Raw input code received from receiver query or status payload (e.g., `"19"`, `"FN19"`, or `"04"`).
 * @returns Human-readable input name (e.g., `"HDMI 1"`, `"DVD"`), or `"Unknown"` if undefined.
 *
 * @example
 * ```ts
 * formatInputLabel("FN19");     // "HDMI 1"
 * formatInputLabel("25");       // "BD"
 * formatInputLabel("99");       // "Input 99"
 * formatInputLabel(undefined);  // "Unknown"
 * ```
 */
export function formatInputLabel(code: string | undefined): string {
  if (!code) return 'Unknown';
  // Strip Pioneer command 'FN' prefix if returned as a raw response (e.g. "FN19")
  const cleanCode = code.replace(/^FN/, '').trim();
  // Find matching preset by raw code or full code string
  const preset = INPUT_PRESETS.find(p => p.code === cleanCode || p.code === code);
  if (preset) return preset.label;
  // Fallback for custom or unmapped input codes
  return `Input ${cleanCode}`;
}

