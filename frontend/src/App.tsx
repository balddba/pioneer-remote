import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PowerControl } from './components/PowerControl';
import { VolumeControl } from './components/VolumeControl';
import { InputSelector } from './components/InputSelector';
import { CommandConsole } from './components/CommandConsole';
import { ToastContainer, ToastMessage } from './components/Toast';
import { api, wsManager } from './services/api';
import { AmplifierStatus } from './types/pioneer';

export const App: React.FC = () => {
  const [status, setStatus] = useState<AmplifierStatus>({
    power: false,
    volume: 0,
    muted: false,
    input: '',
    connected: false,
  });

  const [serverConnected, setServerConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

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

  // Initialize status & WebSocket listener
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

  // Fallback polling if WS is disconnected
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

  // Handlers with Optimistic Updates
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

  const handleVolumeUp = async () => {
    setIsLoading(true);
    try {
      await api.volumeUp();
      // optimistic bump
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

  const handleVolumeDown = async () => {
    setIsLoading(true);
    try {
      await api.volumeDown();
      // optimistic decrement
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

  return (
    <div className="min-h-screen bg-receiver-950 text-slate-100 flex flex-col items-center justify-start pb-10">
      {/* Top Header */}
      <Header
        serverConnected={serverConnected}
        ampConnected={status.connected}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
      />

      {/* Main Remote Container (Constrained width for ergonomic mobile remote feel) */}
      <main className="w-full max-w-md px-3.5 py-4 space-y-4">
        {/* Power & Mute Island */}
        <PowerControl
          power={status.power}
          muted={status.muted}
          onTogglePower={handleTogglePower}
          onToggleMute={handleToggleMute}
          isLoading={isLoading}
        />

        {/* Volume Island */}
        <VolumeControl
          volume={status.volume}
          power={status.power}
          onSetVolume={handleSetVolume}
          onVolumeUp={handleVolumeUp}
          onVolumeDown={handleVolumeDown}
          isLoading={isLoading}
        />

        {/* Input Selector Island */}
        <InputSelector
          currentInput={status.input}
          power={status.power}
          onSelectInput={handleSelectInput}
          isLoading={isLoading}
        />

        {/* Telnet Console */}
        <CommandConsole
          onSendCommand={handleSendRawCommand}
          isLoading={isLoading}
        />
      </main>

      {/* Floating Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};

export default App;
