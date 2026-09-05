import React, { useState, useEffect } from 'react';
import { Volume2, Plus, Minus, ChevronsUp, ChevronsDown } from 'lucide-react';
import { parseVolumeNumber, volumeToDecibels } from '../types/pioneer';
import { triggerHaptic } from '../utils/haptics';

interface VolumeControlProps {
  volume: string | number;
  power: boolean;
  onSetVolume: (vol: number) => Promise<void>;
  onVolumeUp: () => Promise<void>;
  onVolumeDown: () => Promise<void>;
  isLoading: boolean;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  power,
  onSetVolume,
  onVolumeUp,
  onVolumeDown,
  isLoading,
}) => {
  const currentVol = parseVolumeNumber(volume);
  const [sliderValue, setSliderValue] = useState<number>(currentVol);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    if (!isDragging) {
      setSliderValue(currentVol);
    }
  }, [currentVol, isDragging]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSliderValue(val);
    triggerHaptic('light');
  };

  const handleSliderCommit = () => {
    setIsDragging(false);
    triggerHaptic('medium');
    onSetVolume(sliderValue);
  };

  const handleStep = async (delta: number) => {
    triggerHaptic(Math.abs(delta) > 1 ? 'medium' : 'light');
    if (delta === 1) {
      await onVolumeUp();
    } else if (delta === -1) {
      await onVolumeDown();
    } else {
      const nextVal = Math.min(161, Math.max(0, currentVol + delta));
      await onSetVolume(nextVal);
    }
  };

  const handlePreset = async (targetVol: number) => {
    triggerHaptic('medium');
    await onSetVolume(targetVol);
  };

  const percentage = Math.min(100, Math.max(0, Math.round((currentVol / 161) * 100)));

  return (
    <div className={`bg-receiver-900 border border-slate-800 rounded-3xl p-5 shadow-xl transition-all ${!power ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header with Title & Level Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
            Master Volume
          </span>
        </div>
        <span className="text-xs font-mono text-cyan-400/90 font-semibold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
          {percentage}%
        </span>
      </div>

      {/* Large Digital Volume & Decibel Readout */}
      <div className="bg-receiver-950 border border-slate-800/90 rounded-2xl p-4 mb-5 text-center shadow-inner flex flex-col items-center justify-center">
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tighter text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]">
            {isDragging ? sliderValue : currentVol}
          </span>
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            / 161
          </span>
        </div>
        <div className="text-sm font-mono font-medium text-slate-400 mt-1">
          {volumeToDecibels(isDragging ? sliderValue : currentVol)}
        </div>
      </div>

      {/* Mobile-Ergonomic Touch Slider */}
      <div className="mb-6 px-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max="161"
            value={isDragging ? sliderValue : currentVol}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            disabled={isLoading || !power}
            className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 shadow-inner"
            aria-label="Volume level fader"
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 px-1">
          <span>MIN (0)</span>
          <span>REF 0dB (145)</span>
          <span>MAX (161)</span>
        </div>
      </div>

      {/* Step Adjustment Island (Optimized for Mobile Thumbs) */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {/* -5 Coarse Down */}
        <button
          onClick={() => handleStep(-5)}
          disabled={isLoading || currentVol <= 0}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-receiver-800 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 shadow-tactile active:shadow-tactile-pressed disabled:opacity-40 transition-all"
          title="Decrease volume by 5"
          aria-label="Decrease volume by 5"
        >
          <ChevronsDown className="w-4 h-4 mb-0.5 text-slate-400" />
          <span className="text-xs font-mono font-bold">-5</span>
        </button>

        {/* -1 Fine Down */}
        <button
          onClick={() => handleStep(-1)}
          disabled={isLoading || currentVol <= 0}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-receiver-800 border border-slate-700/60 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 shadow-tactile active:shadow-tactile-pressed disabled:opacity-40 transition-all"
          title="Decrease volume by 1"
          aria-label="Decrease volume by 1"
        >
          <Minus className="w-4 h-4 mb-0.5 text-cyan-400" />
          <span className="text-xs font-mono font-bold">-1</span>
        </button>

        {/* +1 Fine Up */}
        <button
          onClick={() => handleStep(1)}
          disabled={isLoading || currentVol >= 161}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-receiver-800 border border-slate-700/60 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 shadow-tactile active:shadow-tactile-pressed disabled:opacity-40 transition-all"
          title="Increase volume by 1"
          aria-label="Increase volume by 1"
        >
          <Plus className="w-4 h-4 mb-0.5 text-cyan-400" />
          <span className="text-xs font-mono font-bold">+1</span>
        </button>

        {/* +5 Coarse Up */}
        <button
          onClick={() => handleStep(5)}
          disabled={isLoading || currentVol >= 161}
          className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-receiver-800 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 shadow-tactile active:shadow-tactile-pressed disabled:opacity-40 transition-all"
          title="Increase volume by 5"
          aria-label="Increase volume by 5"
        >
          <ChevronsUp className="w-4 h-4 mb-0.5 text-slate-400" />
          <span className="text-xs font-mono font-bold">+5</span>
        </button>
      </div>

      {/* Quick Level Presets */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Presets</span>
        <div className="flex space-x-1.5">
          {[30, 50, 75, 100].map((presetVal) => (
            <button
              key={presetVal}
              onClick={() => handlePreset(presetVal)}
              disabled={isLoading || !power}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-all ${
                currentVol === presetVal
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-glow-cyan'
                  : 'bg-receiver-800/70 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              } active:scale-95`}
            >
              {presetVal}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
