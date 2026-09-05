import { AmplifierStatus, CommandResponse } from '../types/pioneer';

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '';
};

const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

class PioneerApiClient {
  private baseUrl = getBaseUrl();

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[API Request] ${options.method || 'GET'} ${url}`);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      console.error(`[API Error] ${options.method || 'GET'} ${url} (${res.status}):`, errorData);
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }
    const data = await res.json();
    console.log(`[API Response] ${options.method || 'GET'} ${url}:`, data);
    return data;
  }

  async getStatus(): Promise<AmplifierStatus> {
    return this.request<AmplifierStatus>('/status');
  }

  async checkHealth(): Promise<{ status: string; connected: boolean; error?: string }> {
    return this.request<{ status: string; connected: boolean; error?: string }>('/health');
  }

  async setPower(power: boolean): Promise<CommandResponse> {
    return this.request<CommandResponse>('/power', {
      method: 'POST',
      body: JSON.stringify({ power }),
    });
  }

  async getPower(): Promise<{ power: boolean; response: string }> {
    return this.request<{ power: boolean; response: string }>('/power');
  }

  async setVolume(volume: number): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume', {
      method: 'POST',
      body: JSON.stringify({ volume }),
    });
  }

  async getVolume(): Promise<{ volume: string; response: string }> {
    return this.request<{ volume: string; response: string }>('/volume');
  }

  async volumeUp(): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume/up', { method: 'POST' });
  }

  async volumeDown(): Promise<CommandResponse> {
    return this.request<CommandResponse>('/volume/down', { method: 'POST' });
  }

  async setMute(muted: boolean): Promise<CommandResponse> {
    return this.request<CommandResponse>('/mute', {
      method: 'POST',
      body: JSON.stringify({ power: muted }),
    });
  }

  async getMute(): Promise<{ muted: boolean; response: string }> {
    return this.request<{ muted: boolean; response: string }>('/mute');
  }

  async setInput(inputCode: string): Promise<CommandResponse> {
    return this.request<CommandResponse>('/input', {
      method: 'POST',
      body: JSON.stringify({ input: inputCode }),
    });
  }

  async getInput(): Promise<{ input: string; response: string }> {
    return this.request<{ input: string; response: string }>('/input');
  }

  async sendRawCommand(command: string): Promise<CommandResponse> {
    const query = new URLSearchParams({ command }).toString();
    return this.request<CommandResponse>(`/command?${query}`, { method: 'POST' });
  }
}

export const api = new PioneerApiClient();

export type WebSocketStatusListener = (status: AmplifierStatus) => void;
export type WebSocketConnectionListener = (connected: boolean) => void;

class PioneerWebSocketManager {
  private ws: WebSocket | null = null;
  private statusListeners = new Set<WebSocketStatusListener>();
  private connListeners = new Set<WebSocketConnectionListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private retryDelay = 2000;

  connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log(`[WS] Connect called but already in state ${this.ws.readyState}`);
      return;
    }

    try {
      const url = getWsUrl();
      console.log(`[WS] Connecting to ${url}...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connection established (OPEN)');
        this.retryDelay = 2000;
        this.notifyConn(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: AmplifierStatus = JSON.parse(event.data);
          console.log('[WS Message Received]:', data);
          this.notifyStatus(data);
        } catch (e) {
          console.warn('[WS Parse Error] Received non-JSON message:', event.data, e);
        }
      };

      this.ws.onclose = (event) => {
        console.warn(`[WS Closed] code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
        this.notifyConn(false);
        this.scheduleReconnect();
      };

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

  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      console.log('[WS] Should not reconnect, skipping schedule');
      return;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    console.log(`[WS] Scheduling reconnect in ${this.retryDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.retryDelay);
    // Exponential backoff capped at 10s
    this.retryDelay = Math.min(this.retryDelay * 1.5, 10000);
  }

  disconnect() {
    console.log('[WS] Disconnect requested');
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyConn(false);
  }

  subscribeStatus(listener: WebSocketStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribeConnection(listener: WebSocketConnectionListener): () => void {
    this.connListeners.add(listener);
    return () => this.connListeners.delete(listener);
  }

  private notifyStatus(status: AmplifierStatus) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private notifyConn(connected: boolean) {
    console.log(`[WS] Notify connection state: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
    for (const listener of this.connListeners) {
      listener(connected);
    }
  }
}

export const wsManager = new PioneerWebSocketManager();
