import React from 'react';
import { Power, VolumeX, Volume2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

/**
 * Props for the {@link PowerControl} component.
 */
interface PowerControlProps {
  /**
   * Current main power state of the receiver (`true` = ON, `false` = Standby/OFF).
   */
  power: boolean;

  /**
   * Current audio mute state (`true` = audio output muted, `false` = normal audio output).
   */
  muted: boolean;

  /**
   * Async callback invoked when toggling the main power state.
   *
   * @param targetPower - The desired power state (`true` for ON, `false` for Standby).
   */
  onTogglePower: (targetPower: boolean) => Promise<void>;

  /**
   * Async callback invoked when toggling the master mute state.
   *
   * @param targetMute - The desired mute state (`true` for Muted, `false` for Unmuted).
   */
  onToggleMute: (targetMute: boolean) => Promise<void>;

  /**
   * Flag indicating whether an API request is currently in-flight, disabling interactions.
   */
  isLoading: boolean;
}

/**
 * Primary power and master mute control panel for the Pioneer AVR.
 *
 * Provides oversized tactile touch buttons with stateful illumination:
 * - Cyan glow when powered ON, dimmed in Standby.
 * - Crimson glow when audio is MUTED, neutral when unmuted.
 * - Includes tactile haptic feedback differentiated by action intensity.
 *
 * @param props - Component properties conforming to {@link PowerControlProps}.
 * @returns Rendered power and mute control card.
 */
export const PowerControl: React.FC<PowerControlProps> = ({
  power,
  muted,
  onTogglePower,
  onToggleMute,
  isLoading,
}) => {
  /**
   * Handle main power toggle with differentiated haptic feedback.
   * Uses heavier haptic impulse when turning on to simulate high-inrush physical relay click.
   */
  const handlePowerClick = () => {
    triggerHaptic(power ? 'medium' : 'heavy');
    onTogglePower(!power);
  };

  /**
   * Handle audio mute toggle with light tactile response.
   */
  const handleMuteClick = () => {
    triggerHaptic('light');
    onToggleMute(!muted);
  };

  return (
    // Receiver chassis card with rounded corners and hardware bezel lighting
    <div className="bg-receiver-900 border border-slate-800 rounded-3xl p-4 shadow-xl relative overflow-hidden">
      {/* Subtle top bevel highlight simulating brushed metallic edge illumination */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="grid grid-cols-2 gap-3">
        {/* Main Power Button: Toggles between Standby and Active state with dynamic cyan neon styling */}
        <button
          onClick={handlePowerClick}
          disabled={isLoading}
          aria-label={power ? 'Turn receiver off' : 'Turn receiver on'}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 select-none ${
            power
              ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500/50 shadow-glow-cyan text-cyan-400'
              : 'bg-receiver-800 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
          } active:scale-[0.98] shadow-tactile active:shadow-tactile-pressed disabled:opacity-60`}
        >
          {/* Circular power icon well with neon ring glow when active */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
              power
                ? 'bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400/40 ring-offset-2 ring-offset-receiver-900'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            }`}
          >
            <Power className={`w-6 h-6 ${power ? 'drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : ''}`} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider font-display">
            {power ? 'Power ON' : 'Standby'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
            {power ? 'Receiver Active' : 'Tap to Wake'}
          </span>
        </button>

        {/* Master Mute Button: Toggles audio mute; disabled if receiver is powered off */}
        <button
          onClick={handleMuteClick}
          disabled={isLoading || !power}
          aria-label={muted ? 'Unmute receiver' : 'Mute receiver'}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 select-none ${
            muted
              ? 'bg-gradient-to-b from-rose-950/50 to-slate-900 border-rose-500/60 shadow-glow-red text-rose-400'
              : 'bg-receiver-800 border-slate-700/60 text-slate-300 hover:text-slate-100 hover:border-slate-600'
          } active:scale-[0.98] shadow-tactile active:shadow-tactile-pressed disabled:opacity-40`}
        >
          {/* Circular mute icon well with warning rose ring glow when muted */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
              muted
                ? 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/40 ring-offset-2 ring-offset-receiver-900'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            }`}
          >
            {muted ? (
              <VolumeX className="w-6 h-6 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider font-display">
            {muted ? 'MUTED' : 'Mute Audio'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
            {muted ? 'Sound Suppressed' : 'Normal Output'}
          </span>
        </button>
      </div>
    </div>
  );
};
