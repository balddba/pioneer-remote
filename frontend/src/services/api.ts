/**
 * Pioneer AVR API Client and Real-Time WebSocket Manager.
 *
 * Provides typed HTTP REST methods for Pioneer AV receiver commands and queries,
 * alongside a resilient WebSocket manager that maintains real-time status telemetry
 * synchronization with automatic exponential-backoff reconnection.
 */

import { AmplifierStatus, CommandResponse } from '../types/pioneer';

/**
 * Resolves the HTTP base URL for backend REST API calls.
 *
 * Prioritizes the `VITE_API_URL` environment variable if configured (useful for separate
 * hosting or local mobile testing pointing directly to the backend IP:port).
 * Otherwise returns an empty string to use relative URLs routed through Vite's dev proxy
 * or same-origin deployment.
 *
 * @returns Base URL string (e.g., `"http://192.168.1.100:8099"` or `""`).
 */
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '';
};

/**
 * Resolves the WebSocket URL for live telemetry streaming.
 *
 * Prioritizes the `VITE_WS_URL` environment variable if configured.
 * Otherwise dynamically determines protocol (`wss:` for HTTPS origins, `ws:` for HTTP)
 * and connects to the `/ws` path on the current browser host.
 *
 * @returns Complete WebSocket endpoint URI (e.g., `"ws://localhost:5173/ws"` or `"wss://remote.home/ws"`).
 */
const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

/**
 * HTTP REST client for dispatching commands to the Pioneer AV receiver backend daemon.
 */
class PioneerApiClient {
  /** Resolved base URL prefix for all HTTP requests. */
  private baseUrl = getBaseUrl();

  /**
   * Internal helper for executing HTTP requests with JSON serialization and unified error handling.
   *
   * @template T - Expected response payload type.
   * @param endpoint - Request endpoint path relative to `baseUrl` (e.g., `"/status"`).
   * @param options - Fetch options including HTTP method, headers, and request body.
   * @returns Deserialized JSON response payload.
   * @throws Error with server-provided detail or status code if response is not OK (2xx).
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[API Request] ${options.method || 'GET'} ${url}`);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      // Attempt to parse JSON error response (e.g., FastAPI's {"detail": "..."})
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      console.error(`[API Error] ${options.method || 'GET'} ${url} (${res.status}):`, errorData);
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }
    const data = await res.json();
    console.log(`[API Response] ${options.method || 'GET'} ${url}:`, data);
    return data;
  }

  /**
   * Fetches the current aggregated status of the AV receiver.
   *
   * @returns Promise resolving to the current `AmplifierStatus` snapshot
   * (power, volume, mute, active input, and connection status).
   * @throws Error if network request fails or receiver is unreachable.
   */
  async getStatus(): Promise<AmplifierStatus> {
    return this.request<AmplifierStatus>('/status');
  }

  /**
   * Checks the health and connectivity of the backend controller daemon and Pioneer AVR.
   *
   * @returns Promise resolving to health check object with status, socket connection flag, and error detail.
   * @throws Error if the health endpoint fails to respond.
   */
  async checkHealth(): Promise<{ status: string; connected: boolean; error?: string }> {
    return this.request<{ status: string; connected: boolean; error?: string }>('/health');
  }

  /**
   * Powers the AV receiver ON or puts it into STANDBY.
   *
   * Sends Pioneer ASCII command `"PO"` (Power On) or `"PF"` (Power Off / Standby).
   * Note that waking from cold standby over network may take 3-5 seconds.
   *
   * @param power - `true` to power ON; `false` to enter STANDBY.
   * @returns Promise resolving to the command execution response.
   * @throws Error if the command fails or times out.
   */
  async setPower(power: boolean): Promise<CommandResponse> {
    return this.request<CommandResponse>('/power', {
      method: 'POST',
      body: JSON.stringify({ power }),
    });
  }

  /**
   * Queries the receiver hardware for its current power status.
   *
   * Dispatches Pioneer query command `"?P"`.
   *
   * @returns Promise resolving to the power status boolean and raw Pioneer response (e.g. `"PWR0"`).
   * @throws Error if communication fails.
   */
  async getPower(): Promise<{ power: boolean; response: string }> {
    return this.request<{ power: boolean; response: string }>('/power');
  }

  /**
   * Sets the master volume level directly on the AV receiver.
   *
   * Pioneer uses a 0 to 161 scale where:
   * - 0 = -80.0 dB (Min / Mute level)
   * - 145 = 0.0 dB (Reference level)
   * - 161 = +12.0 dB (Max volume)
   * Dispatches command formatted as `${volume}VL` (e.g., `"080VL"`).
   *
   * @param volume - Target raw integer volume level between 0 and 161.
   * @returns Promise resolving to command response confirmation.
   * @throws Error if out of bounds or communication fails.
   */
  async setVolume(volume: number): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume', {
      method: 'POST',
      body: JSON.stringify({ volume }),
    });
  }

  /**
   * Queries the current master volume level from the AV receiver.
   *
   * Dispatches Pioneer query command `"?V"`.
   *
   * @returns Promise resolving to the volume value and raw protocol response (e.g., `"VOL080"`).
   * @throws Error if communication fails.
   */
  async getVolume(): Promise<{ volume: string; response: string }> {
    return this.request<{ volume: string; response: string }>('/volume');
  }

  /**
   * Increments the master volume by 1 step (+0.5 dB).
   *
   * Dispatches Pioneer command `"VU"` (Volume Up).
   *
   * @returns Promise resolving to command response confirmation.
   * @throws Error if maximum volume reached or communication fails.
   */
  async volumeUp(): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume/up', { method: 'POST' });
  }

  /**
   * Decrements the master volume by 1 step (-0.5 dB).
   *
   * Dispatches Pioneer command `"VD"` (Volume Down).
   *
   * @returns Promise resolving to command response confirmation.
   * @throws Error if minimum volume reached or communication fails.
   */
  async volumeDown(): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume/down', { method: 'POST' });
  }

  /**
   * Sets the audio mute state on the AV receiver.
   *
   * Dispatches Pioneer command `"MO"` (Mute On) or `"MF"` (Mute Off).
   *
   * @param muted - `true` to mute audio output; `false` to unmute.
   * @returns Promise resolving to command response confirmation.
   * @throws Error if communication fails.
   */
  async setMute(muted: boolean): Promise<CommandResponse> {
    return this.request<CommandResponse>('/mute', {
      method: 'POST',
      // Note: Backend endpoint accepts power field as the mute toggle boolean
      body: JSON.stringify({ power: muted }),
    });
  }

  /**
   * Queries the current audio mute state from the AV receiver.
   *
   * Dispatches Pioneer query command `"?M"`.
   *
   * @returns Promise resolving to mute boolean and raw protocol response (`"MUT0"` for on, `"MUT1"` for off).
   * @throws Error if communication fails.
   */
  async getMute(): Promise<{ muted: boolean; response: string }> {
    return this.request<{ muted: boolean; response: string }>('/mute');
  }

  /**
   * Switches the active input source on the AV receiver.
   *
   * Dispatches command formatted as `${inputCode}FN` (e.g., `"19FN"` for HDMI 1, `"04FN"` for DVD).
   *
   * @param inputCode - Two-digit Pioneer input function code (e.g. `"19"`, `"04"`, `"25"`).
   * @returns Promise resolving to command response confirmation.
   * @throws Error if invalid input code or communication fails.
   */
  async setInput(inputCode: string): Promise<CommandResponse> {
    return this.request<CommandResponse>('/input', {
      method: 'POST',
      body: JSON.stringify({ input: inputCode }),
    });
  }

  /**
   * Queries the currently selected input function from the AV receiver.
   *
   * Dispatches Pioneer query command `"?F"`.
   *
   * @returns Promise resolving to input code and raw protocol response (e.g. `"FN19"`).
   * @throws Error if communication fails.
   */
  async getInput(): Promise<{ input: string; response: string }> {
    return this.request<{ input: string; response: string }>('/input');
  }

  /**
   * Sends an arbitrary raw ASCII Pioneer command string directly to the receiver.
   *
   * Useful for specialized Pioneer commands not exposed by dedicated REST routes
   * (e.g., tone controls, listening modes, tuner presets).
   *
   * @param command - Raw Pioneer command string (e.g., `"?V"`, `"19FN"`, `"PO"`).
   * @returns Promise resolving to command response with raw receiver reply.
   * @throws Error if command dispatch fails.
   */
  async sendRawCommand(command: string): Promise<CommandResponse> {
    const query = new URLSearchParams({ command }).toString();
    return this.request<CommandResponse>(`/command?${query}`, { method: 'POST' });
  }
}

/**
 * Singleton API client instance for making REST requests to the Pioneer receiver backend.
 */
export const api = new PioneerApiClient();

/**
 * Callback listener signature for receiving real-time receiver status updates.
 *
 * @param status - Latest telemetry snapshot broadcast by the backend daemon.
 */
export type WebSocketStatusListener = (status: AmplifierStatus) => void;

/**
 * Callback listener signature for receiving WebSocket connection state transitions.
 *
 * @param connected - `true` when WebSocket connection is active and open; `false` otherwise.
 */
export type WebSocketConnectionListener = (connected: boolean) => void;

/**
 * Real-time WebSocket connection manager.
 *
 * Manages connection lifecycle, event parsing, subscriber registries, and automatic
 * reconnection with capped exponential backoff.
 */
class PioneerWebSocketManager {
  /** Active WebSocket connection instance or `null` when disconnected. */
  private ws: WebSocket | null = null;

  /** Set of subscribed status event callbacks. */
  private statusListeners = new Set<WebSocketStatusListener>();

  /** Set of subscribed connection state event callbacks. */
  private connListeners = new Set<WebSocketConnectionListener>();

  /** Timer reference for pending reconnection attempt. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Flag indicating whether reconnection attempts should continue. Set to false on manual disconnect. */
  private shouldReconnect = true;

  /** Reconnect delay in milliseconds; increases exponentially up to 10,000ms. */
  private retryDelay = 2000;

  /**
   * Establishes the WebSocket connection to the backend telemetry stream.
   *
   * Idempotent: does nothing if already connected or in the process of connecting.
   * Initializes listeners for open, message, close, and error events.
   */
  connect() {
    this.shouldReconnect = true;
    // Guard against duplicate connection attempts while already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log(`[WS] Connect called but already in state ${this.ws.readyState}`);
      return;
    }

    try {
      const url = getWsUrl();
      console.log(`[WS] Connecting to ${url}...`);
      this.ws = new WebSocket(url);

      // Connection opened successfully: reset backoff and notify connection listeners
      this.ws.onopen = () => {
        console.log('[WS] Connection established (OPEN)');
        this.retryDelay = 2000;
        this.notifyConn(true);
      };

      // Inbound telemetry packet: parse JSON and broadcast to status subscribers
      this.ws.onmessage = (event) => {
        try {
          const data: AmplifierStatus = JSON.parse(event.data);
          console.log('[WS Message Received]:', data);
          this.notifyStatus(data);
        } catch (e) {
          console.warn('[WS Parse Error] Received non-JSON message:', event.data, e);
        }
      };

      // Connection closed: notify listeners and schedule automatic retry
      this.ws.onclose = (event) => {
        console.warn(`[WS Closed] code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
        this.notifyConn(false);
        this.scheduleReconnect();
      };

      // Connection error: log error, trigger disconnect notification, and terminate socket
      this.ws.onerror = (event) => {
        console.error('[WS Error Event]:', event);
        this.notifyConn(false);
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      console.error('[WS Connection Exception]:', err);
      this.notifyConn(false);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedules a reconnection attempt using exponential backoff capped at 10 seconds.
   */
  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      console.log('[WS] Should not reconnect, skipping schedule');
      return;
    }
    // Clear any existing reconnection timer to prevent duplicate runs
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    console.log(`[WS] Scheduling reconnect in ${this.retryDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.retryDelay);
    // Exponential backoff: multiply delay by 1.5, capped at 10,000ms (10 seconds)
    this.retryDelay = Math.min(this.retryDelay * 1.5, 10000);
  }

  /**
   * Disconnects the active WebSocket connection and cancels any scheduled reconnects.
   *
   * Call when tearing down components or unmounting the application.
   */
  disconnect() {
    console.log('[WS] Disconnect requested');
    this.shouldReconnect = false;
    // Clear pending reconnection timer if one is active
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Close the active socket cleanly
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyConn(false);
  }

  /**
   * Subscribes a listener to receiver status updates pushed from the backend.
   *
   * @param listener - Callback function receiving the updated `AmplifierStatus`.
   * @returns Unsubscribe cleanup function to unregister the listener.
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   const unsubscribe = wsManager.subscribeStatus((status) => {
   *     setVolume(status.volume);
   *   });
   *   return unsubscribe;
   * }, []);
   * ```
   */
  subscribeStatus(listener: WebSocketStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribes a listener to WebSocket connection state changes (connected / disconnected).
   *
   * @param listener - Callback function receiving the boolean connection state.
   * @returns Unsubscribe cleanup function to unregister the listener.
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   const unsubscribe = wsManager.subscribeConnection((connected) => {
   *     setIsOnline(connected);
   *   });
   *   return unsubscribe;
   * }, []);
   * ```
   */
  subscribeConnection(listener: WebSocketConnectionListener): () => void {
    this.connListeners.add(listener);
    return () => this.connListeners.delete(listener);
  }

  /**
   * Notifies all registered status listeners with the latest amplifier status.
   *
   * @param status - The received `AmplifierStatus` object.
   */
  private notifyStatus(status: AmplifierStatus) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  /**
   * Notifies all registered connection listeners with the current connection state.
   *
   * @param connected - Current connection state (`true` if connected, `false` otherwise).
   */
  private notifyConn(connected: boolean) {
    console.log(`[WS] Notify connection state: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
    for (const listener of this.connListeners) {
      listener(connected);
    }
  }
}

/**
 * Singleton instance of the WebSocket manager for real-time telemetry streaming.
 */
export const wsManager = new PioneerWebSocketManager();

