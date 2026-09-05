import React, { useState } from 'react';
import {
  Tv,
  Disc,
  Gamepad2,
  Radio,
  Music,
  Wifi,
  Cast,
  Cable,
  Sliders,
} from 'lucide-react';
import { INPUT_PRESETS, InputPreset, formatInputLabel } from '../types/pioneer';
import { triggerHaptic } from '../utils/haptics';

interface InputSelectorProps {
  currentInput: string;
  power: boolean;
  onSelectInput: (inputCode: string) => Promise<void>;
  isLoading: boolean;
}

const renderIcon = (iconName: InputPreset['iconName']) => {
  const iconClass = 'w-4 h-4';
  switch (iconName) {
    case 'Tv':
      return <Tv className={iconClass} />;
    case 'Disc':
      return <Disc className={iconClass} />;
    case 'Gamepad2':
      return <Gamepad2 className={iconClass} />;
    case 'Radio':
      return <Radio className={iconClass} />;
    case 'Music':
      return <Music className={iconClass} />;
    case 'Wifi':
      return <Wifi className={iconClass} />;
    case 'Cast':
      return <Cast className={iconClass} />;
    case 'Cable':
      return <Cable className={iconClass} />;
    default:
      return <Sliders className={iconClass} />;
  }
};

export const InputSelector: React.FC<InputSelectorProps> = ({
  currentInput,
  power,
  onSelectInput,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'hdmi' | 'media' | 'audio' | 'network'>('all');
  const [customCode, setCustomCode] = useState<string>('');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Normalize currentInput (e.g. "FN19" -> "19")
  const cleanInput = currentInput.replace(/^FN/, '').trim();

  const handleInputSelect = async (code: string) => {
    triggerHaptic('medium');
    await onSelectInput(code);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim()) return;
    triggerHaptic('medium');
    await onSelectInput(customCode.trim());
    setCustomCode('');
    setShowCustomModal(false);
  };

  const filteredPresets = INPUT_PRESETS.filter((preset) => {
    if (activeTab === 'all') return true;
    return preset.category === activeTab;
  });

  return (
    <div className={`bg-receiver-900 border border-slate-800 rounded-3xl p-5 shadow-xl transition-all ${!power ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header & Current Active Input Banner */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
            Input Source
          </span>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Active: <span className="text-cyan-400 font-semibold">{formatInputLabel(currentInput)}</span>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic('light');
            setShowCustomModal(true);
          }}
          disabled={isLoading || !power}
          className="text-xs font-mono px-2.5 py-1 rounded-lg bg-receiver-800 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all shadow-tactile"
        >
          Custom FN
        </button>
      </div>

      {/* Category Tabs (Horizontal Scrollable for Mobile) */}
      <div className="flex space-x-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {(['all', 'hdmi', 'media', 'audio', 'network'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              triggerHaptic('light');
              setActiveTab(tab);
            }}
            className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-tight transition-all shrink-0 ${
              activeTab === tab
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                : 'bg-receiver-800/60 text-slate-400 border border-transparent hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Input Presets Grid (Mobile Touch Sized) */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2.5">
        {filteredPresets.map((preset) => {
          const isActive = cleanInput === preset.code || currentInput === preset.code;
          return (
            <button
              key={preset.id}
              onClick={() => handleInputSelect(preset.code)}
              disabled={isLoading || !power}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center min-h-[72px] relative overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900 border-cyan-400/80 shadow-glow-cyan text-cyan-300 ring-1 ring-cyan-400/40'
                  : 'bg-receiver-800/80 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:text-slate-100'
              } active:scale-[0.97] shadow-tactile active:shadow-tactile-pressed disabled:opacity-40`}
            >
              {/* Active Indicator Pip */}
              {isActive && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-glow-cyan" />
              )}
              <div className={`mb-1.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}>
                {renderIcon(preset.iconName)}
              </div>
              <span className="text-xs font-semibold font-display tracking-tight leading-tight">
                {preset.label}
              </span>
              {preset.description && (
                <span className="text-[10px] text-slate-500 font-mono truncate w-full mt-0.5">
                  {preset.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom FN Code Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-receiver-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display mb-2">
              Send Pioneer Function Code
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Enter 2-digit Pioneer input code (e.g., 04 for DVD, 19 for HDMI 1, 25 for BD).
            </p>
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 19 or 04"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-receiver-950 border border-slate-700 text-slate-100 font-mono text-center text-lg tracking-widest focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-receiver-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customCode.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow-cyan disabled:opacity-50"
                >
                  Send Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
