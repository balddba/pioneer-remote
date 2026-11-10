/**
 * @file App.tsx
 * @description Root application component for PioneerRemote web interface.
 * Orchestrates real-time state synchronization, optimistic command dispatchers,
 * dual-channel communication (WebSocket streaming with REST polling fallback),
 * and mobile-first ergonomic remote control layout.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PowerControl } from './components/PowerControl';
import { VolumeControl } from './components/VolumeControl';
import { InputSelector } from './components/InputSelector';
import { CommandConsole } from './components/CommandConsole';
import { ToastContainer, ToastMessage } from './components/Toast';
import { api, wsManager } from './services/api';
import { AmplifierStatus } from './types/pioneer';

/**
 * Root React application component for Pioneer Remote.
 *
 * Architecture & Features:
 * - **Dual-Channel Synchronization**: Consumes real-time receiver telemetry via persistent
 *   WebSocket (`wsManager`). If the WebSocket disconnects, a background fallback polling
 *   interval queries the REST endpoint (`/api/status`) every 5 seconds until connection is restored.
 * - **Optimistic UI Updates**: Command dispatchers immediately update React state to provide
 *   instant tactile visual feedback (essential for responsive remote control feel), while
 *   asynchronously dispatching commands via REST. If a command fails or times out, state
 *   is automatically rolled back to the prior known state and an error toast is surfaced.
 * - **Ergonomic Remote Control Layout**: Constrained to a mobile-friendly width (`max-w-md`)
 *   with modular "island" control groups (Power & Mute, Volume, Input Selector, Telnet Console).
 * - **Transient Notification Queue**: Manages toast notifications with automatic dismissal timers.
 * - **Keyboard & Touch Accessibility**: Designed for tap/click feedback and keyboard navigation
 *   across interactive buttons and input selectors.
 *
 * @component
 * @returns {React.ReactElement} Rendered application tree with header, control islands, and toast container.
 */
export const App: React.FC = () => {
  /**
   * Current Pioneer AVR telemetry status snapshot.
   * Tracks power state, volume level (0-161), mute status, active input source code,
   * and physical receiver hardware connectivity flag.
   */
  const [status, setStatus] = useState<AmplifierStatus>({
    power: false,
    volume: 0,
    muted: false,
    input: '',
    connected: false,
  });

  /**
   * Backend bridge connectivity status.
   * `true` when the WebSocket connection is active or recent REST calls succeeded;
   * `false` when connection to the backend server is lost.
   */
  const [serverConnected, setServerConnected] = useState<boolean>(false);

  /**
   * Indicator flag for manual status refresh in progress (triggers spin animation in Header).
   */
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  /**
   * Transient command execution flag.
   * Disables interactive controls or displays loading states during active remote commands.
   */
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Notification toast queue.
   * Array of transient toast messages currently displayed on the screen.
   */
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * Enqueues a transient notification toast banner.
   * Generates a random identifier and schedules automated dismissal after 3500ms.
   *
   * @param {'success' | 'error' | 'info'} type - Notification visual variant and icon theme.
   * @param {string} text - Human-readable notification message to display.
   */
  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  /**
   * Fetches fresh receiver status telemetry from the REST API endpoint (`/api/status`).
   *
   * Sets `serverConnected` to `true` upon success, updates the `status` state,
   * and toggles `isRefreshing` to drive UI loading indicators. On network or server
   * failure, marks `serverConnected` as `false`.
   */
  const fetchStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('[App] fetchStatus starting...');
      const data = await api.getStatus();
      console.log('[App] fetchStatus success, setting status:', data);
      setStatus(data);
      setServerConnected(true);
    } catch (err: any) {
      console.error('[App] fetchStatus failed:', err);
      setServerConnected(false);
      // Only show error toast if explicitly triggered by user refresh
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /**
   * WebSocket Lifecycle & Telemetry Subscription Effect.
   *
   * Side-effects executed on component mount:
   * 1. Performs an initial baseline REST status query via `fetchStatus()`.
   * 2. Establishes the WebSocket connection via `wsManager.connect()`.
   * 3. Subscribes to broadcasted receiver status events (`wsManager.subscribeStatus`),
   *    updating state in real-time as changes occur (e.g., from physical remote or knob turns).
   * 4. Subscribes to transport connection events (`wsManager.subscribeConnection`),
   *    triggering a fresh status fetch whenever the socket transitions to connected.
   *
   * Cleanup:
   * Unsubscribes all listeners and closes the WebSocket connection on component unmount
   * to prevent memory leaks and orphaned sockets.
   */
  useEffect(() => {
    console.log('[App] Mounting WebSocket connection and subscriptions...');
    fetchStatus();
    wsManager.connect();

    const unsubStatus = wsManager.subscribeStatus((newStatus) => {
      console.log('[App] WebSocket pushed new status:', newStatus);
      setStatus(newStatus);
      setServerConnected(true);
    });

    const unsubConn = wsManager.subscribeConnection((connected) => {
      console.log(`[App] WebSocket connection state changed -> ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
      setServerConnected(connected);
      if (connected) {
        fetchStatus();
      }
    });

    return () => {
      console.log('[App] Unmounting WebSocket listener & disconnecting...');
      unsubStatus();
      unsubConn();
      wsManager.disconnect();
    };
  }, [fetchStatus]);

  /**
   * Fallback Polling Effect.
   *
   * When WebSocket connectivity is interrupted (`serverConnected === false`), this effect
   * initiates a 5-second recurring interval that queries `fetchStatus()` via HTTP REST.
   * Once WebSocket connectivity is restored, the polling interval is cleared and idle.
   */
  useEffect(() => {
    if (serverConnected) return;

    console.log('[App] Fallback polling active (WS is disconnected)');
    const interval = setInterval(() => {
      console.log('[App] Fallback polling tick -> fetchStatus()');
      fetchStatus();
    }, 5000);

    return () => {
      console.log('[App] Clearing fallback polling interval');
      clearInterval(interval);
    };
  }, [fetchStatus, serverConnected]);

  // =========================================================================
  // Command Dispatchers & Handlers with Optimistic Updates and Rollback
  // =========================================================================

  /**
   * Dispatches a power toggle command (ON / STANDBY).
   *
   * Implements optimistic UI updating: immediately toggles `status.power`,
   * issues the REST request (`api.setPower`), displays a confirmation toast,
   * and reverts to `prevPower` if the request fails.
   *
   * @param {boolean} targetPower - Desired target power state (`true` for ON, `false` for STANDBY).
   */
  const handleTogglePower = async (targetPower: boolean) => {
    const prevPower = status.power;
    setStatus((prev) => ({ ...prev, power: targetPower }));
    setIsLoading(true);

    try {
      const res = await api.setPower(targetPower);
      showToast('success', res.message || `Power turned ${targetPower ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, power: prevPower }));
      showToast('error', `Failed to set power: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches an audio mute toggle command (MUTED / UNMUTED).
   *
   * Optimistically updates `status.muted`, sends `api.setMute`, and rolls back
   * to `prevMute` if an error occurs.
   *
   * @param {boolean} targetMute - Desired mute state (`true` to mute, `false` to unmute).
   */
  const handleToggleMute = async (targetMute: boolean) => {
    const prevMute = status.muted;
    setStatus((prev) => ({ ...prev, muted: targetMute }));
    setIsLoading(true);

    try {
      const res = await api.setMute(targetMute);
      showToast('success', res.message || `Mute ${targetMute ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, muted: prevMute }));
      showToast('error', `Failed to set mute: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches an absolute volume level command.
   *
   * Optimistically updates `status.volume`, issues `api.setVolume(targetVol)`,
   * and rolls back to `prevVol` if rejected by the receiver or server.
   *
   * @param {number} targetVol - Integer volume level index (typically 0-161).
   */
  const handleSetVolume = async (targetVol: number) => {
    const prevVol = status.volume;
    setStatus((prev) => ({ ...prev, volume: targetVol }));
    setIsLoading(true);

    try {
      const res = await api.setVolume(targetVol);
      showToast('success', res.message || `Volume set to ${targetVol}`);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, volume: prevVol }));
      showToast('error', `Failed to set volume: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches an incremental Volume Up step (`VU`).
   *
   * Increments current volume by +1 (bounded at upper limit 161). Handles both
   * numeric and string-encoded volume telemetry formats with optimistic UI updates.
   */
  const handleVolumeUp = async () => {
    setIsLoading(true);
    try {
      await api.volumeUp();
      // optimistic bump with upper boundary clamping
      setStatus((prev) => {
        const curr = typeof prev.volume === 'number' ? prev.volume : parseInt(String(prev.volume).match(/\d+/)?.[0] || '0', 10);
        return { ...prev, volume: Math.min(161, curr + 1) };
      });
    } catch (err: any) {
      showToast('error', `Volume up failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches a decremental Volume Down step (`VD`).
   *
   * Decrements current volume by -1 (bounded at lower limit 0). Handles both
   * numeric and string-encoded volume telemetry formats with optimistic UI updates.
   */
  const handleVolumeDown = async () => {
    setIsLoading(true);
    try {
      await api.volumeDown();
      // optimistic decrement with lower boundary clamping
      setStatus((prev) => {
        const curr = typeof prev.volume === 'number' ? prev.volume : parseInt(String(prev.volume).match(/\d+/)?.[0] || '0', 10);
        return { ...prev, volume: Math.max(0, curr - 1) };
      });
    } catch (err: any) {
      showToast('error', `Volume down failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches an input source selection command.
   *
   * Switches the receiver active input source (e.g. '04' for DVD, '25' for BD).
   * Applies an optimistic update to `status.input` and reverts if the command fails.
   *
   * @param {string} inputCode - Pioneer two-digit or identifier input code.
   */
  const handleSelectInput = async (inputCode: string) => {
    const prevInput = status.input;
    setStatus((prev) => ({ ...prev, input: inputCode }));
    setIsLoading(true);

    try {
      const res = await api.setInput(inputCode);
      showToast('success', res.message || `Input switched to ${inputCode}`);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, input: prevInput }));
      showToast('error', `Failed to change input: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Dispatches an arbitrary raw Pioneer ASCII command string to the backend telnet bridge.
   *
   * Used by the diagnostic `CommandConsole` component. Shows a toast on success
   * and re-throws any caught error so the console component can log the error response.
   *
   * @param {string} cmd - Raw Pioneer command string (e.g., '?P', '?V', '04FN').
   * @returns {Promise<any>} Response payload from the command bridge API.
   * @throws {Error} If command dispatch fails or times out.
   */
  const handleSendRawCommand = async (cmd: string) => {
    setIsLoading(true);
    try {
      const res = await api.sendRawCommand(cmd);
      showToast('success', `Sent: ${cmd}`);
      return res;
    } catch (err: any) {
      showToast('error', `Command failed: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // Layout Rendering & Component Composition
  // =========================================================================

  return (
    <div className="min-h-screen bg-receiver-950 text-slate-100 flex flex-col items-center justify-start pb-10">
      {/* 
        Top Application Header:
        Displays connection status indicators for both backend bridge (`serverConnected`)
        and physical receiver (`ampConnected`), alongside manual telemetry refresh controls.
      */}
      <Header
        serverConnected={serverConnected}
        ampConnected={status.connected}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
      />

      {/* 
        Main Remote Control Container:
        Constrained to mobile max width (`max-w-md`) to ensure ergonomic, thumb-friendly
        one-handed navigation and tactile card grouping.
      */}
      <main className="w-full max-w-md px-3.5 py-4 space-y-4">
        {/* Power & Mute Island: Quick toggles for primary receiver state */}
        <PowerControl
          power={status.power}
          muted={status.muted}
          onTogglePower={handleTogglePower}
          onToggleMute={handleToggleMute}
          isLoading={isLoading}
        />

        {/* Volume Island: Slider, direct stepper buttons, and dB level calculation */}
        <VolumeControl
          volume={status.volume}
          power={status.power}
          onSetVolume={handleSetVolume}
          onVolumeUp={handleVolumeUp}
          onVolumeDown={handleVolumeDown}
          isLoading={isLoading}
        />

        {/* Input Selector Island: Grid of configured audio/video source inputs */}
        <InputSelector
          currentInput={status.input}
          power={status.power}
          onSelectInput={handleSelectInput}
          isLoading={isLoading}
        />

        {/* Diagnostic Command Console: Collapsible terminal for raw ASCII Pioneer telnet commands */}
        <CommandConsole
          onSendCommand={handleSendRawCommand}
          isLoading={isLoading}
        />
      </main>

      {/* 
        Floating Toast Notifications:
        Non-blocking status badges positioned above viewport content for command confirmations and errors.
      */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};

export default App;
