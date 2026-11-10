import React from 'react';
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

/**
 * Props for the {@link Header} component.
 */
interface HeaderProps {
  /**
   * Whether the client has an active WebSocket/HTTP connection to the backend proxy server.
   */
  serverConnected: boolean;

  /**
   * Whether the backend proxy server currently maintains an open Telnet session to the Pioneer AVR.
   */
  ampConnected: boolean;

  /**
   * Callback invoked when the user manually requests a status refresh from the amplifier.
   */
  onRefresh: () => void;

  /**
   * Whether a status refresh operation is currently in-flight (triggers spinner animation).
   */
  isRefreshing: boolean;
}

/**
 * Application header displaying branding, receiver connection status, and manual refresh controls.
 *
 * Provides real-time visual feedback on both the backend proxy connection and the AVR Telnet link,
 * featuring a tactile refresh button with haptic feedback and animation.
 *
 * @param props - Component properties conforming to {@link HeaderProps}.
 * @returns Rendered sticky application header.
 */
export const Header: React.FC<HeaderProps> = ({
  serverConnected,
  ampConnected,
  onRefresh,
  isRefreshing,
}) => {
  /**
   * Trigger light tactile feedback and dispatch the refresh request.
   */
  const handleRefresh = () => {
    triggerHaptic('light');
    onRefresh();
  };

  // Receiver is fully operational only when both the proxy server and the AVR Telnet session are active
  const isFullyOnline = serverConnected && ampConnected;

  return (
    // Sticky header with glassmorphism backdrop blur and subtle border
    <header className="w-full bg-receiver-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 px-4 py-3 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand & Title: Displays Pioneer AVR branding and default network endpoint info */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center shadow-inner">
            <Radio className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-slate-100 font-display">
                Pioneer
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold border border-cyan-500/20">
                AVR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">10.1.1.199:8102</p>
          </div>
        </div>

        {/* Status Indicator & Refresh: Dynamic connection status badge and refresh action button */}
        <div className="flex items-center space-x-2">
          {/* Status badge: Emerald (full link), Amber (proxy only/standby), or Rose (offline) */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isFullyOnline
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-glow-green'
                : serverConnected
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-400 shadow-glow-amber'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-400 shadow-glow-red'
            }`}
          >
            {isFullyOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] font-mono tracking-tight hidden xs:inline">
              {isFullyOnline ? 'LINKED' : serverConnected ? 'STANDBY' : 'OFFLINE'}
            </span>
          </div>

          {/* Refresh button: Spins when refreshing is in progress, with tactile press effect */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-receiver-800 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 active:scale-95 transition-all shadow-tactile active:shadow-tactile-pressed disabled:opacity-50"
            title="Refresh status"
            aria-label="Refresh amplifier status"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
