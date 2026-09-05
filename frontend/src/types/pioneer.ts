export interface AmplifierStatus {
  power: boolean;
  volume: string | number;
  muted: boolean;
  input: string;
  connected: boolean;
  error?: string;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  response?: string | null;
}

export interface InputPreset {
  id: string;
  label: string;
  code: string;
  category: 'hdmi' | 'media' | 'audio' | 'network' | 'custom';
  iconName: 'Tv' | 'Disc' | 'Gamepad2' | 'Radio' | 'Music' | 'Wifi' | 'Cast' | 'Cable' | 'Sliders';
  description?: string;
}

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
 * Parses numeric volume value from Pioneer response string (e.g. "VOL080" or "80" or 80)
 */
export function parseVolumeNumber(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Converts Pioneer raw volume (0-161) to human readable dB string
 * 0 = -80.0 dB (Min / Mute-level)
 * 161 = +12.0 dB (Max)
 * 145 = 0.0 dB (Reference)
 */
export function volumeToDecibels(volume: number): string {
  if (volume <= 0) return '-\u221E dB';
  const db = (volume - 161) * 0.5 + 12.0;
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/**
 * Formats Pioneer input code to human-readable label
 */
export function formatInputLabel(code: string | undefined): string {
  if (!code) return 'Unknown';
  // Strip FN prefix if returned like "FN19"
  const cleanCode = code.replace(/^FN/, '').trim();
  const preset = INPUT_PRESETS.find(p => p.code === cleanCode || p.code === code);
  if (preset) return preset.label;
  return `Input ${cleanCode}`;
}
