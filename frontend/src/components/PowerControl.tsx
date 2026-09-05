import React from 'react';
import { Power, VolumeX, Volume2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface PowerControlProps {
  power: boolean;
  muted: boolean;
  onTogglePower: (targetPower: boolean) => Promise<void>;
  onToggleMute: (targetMute: boolean) => Promise<void>;
  isLoading: boolean;
}

export const PowerControl: React.FC<PowerControlProps> = ({
  power,
  muted,
  onTogglePower,
  onToggleMute,
  isLoading,
}) => {
  const handlePowerClick = () => {
    triggerHaptic(power ? 'medium' : 'heavy');
    onTogglePower(!power);
  };

  const handleMuteClick = () => {
    triggerHaptic('light');
    onToggleMute(!muted);
  };

  return (
    <div className="bg-receiver-900 border border-slate-800 rounded-3xl p-4 shadow-xl relative overflow-hidden">
      {/* Subtle top bevel highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="grid grid-cols-2 gap-3">
        {/* Main Power Button */}
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

        {/* Master Mute Button */}
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
