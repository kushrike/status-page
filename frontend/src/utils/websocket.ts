import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { Service, Incident } from '../types/types';

interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

type WebSocketMessageHandlers = {
  service_status_update?: (data: Service) => void;
  incident_update?: (data: Incident) => void;
  initial_state?: (data: { incidents: Incident[]; services: Service[] }) => void;
};

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private handlers: WebSocketMessageHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number = 1000;
  private orgId: string;
  private token: string;

  constructor(orgId: string, token: string) {
    this.orgId = orgId;
    this.token = token;
  }

  connect() {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/status/org/${this.orgId}/?token=${this.token}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectTimeout = 1000;
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handler = this.handlers[message.type as keyof WebSocketMessageHandlers];

        if (handler) {
          handler(message.data);
          // Show toast only if handler exists and processes the message
          switch (message.type) {
            case 'service_status_update':
              toast.success('Service status updated');
              break;
            case 'incident_update':
              toast.success('New incident update');
              break;
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
        );
        this.connect();
        this.reconnectAttempts++;
        this.reconnectTimeout *= 2; // Exponential backoff
      }, this.reconnectTimeout);
    }
  }

  addMessageHandler<T extends keyof WebSocketMessageHandlers>(
    type: T,
    handler: NonNullable<WebSocketMessageHandlers[T]>
  ) {
    this.handlers[type] = handler;
  }

  removeMessageHandler(type: keyof WebSocketMessageHandlers) {
    delete this.handlers[type];
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Create a singleton instance for the app
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(orgId: string, token: string) {
  if (wsManager) {
    wsManager.disconnect();
  }
  wsManager = new WebSocketManager(orgId, token);
  wsManager.connect();
  return wsManager;
}

export const getWebSocketManager = () => {
  if (!wsManager) {
    console.warn('WebSocket manager not initialized yet, initializing with stored values...');
    return null;
  }
  return wsManager;
};

// Helper to safely add message handlers
export const addWebSocketHandler = <T extends keyof WebSocketMessageHandlers>(
  type: T,
  handler: NonNullable<WebSocketMessageHandlers[T]>
) => {
  const manager = getWebSocketManager();
  if (manager) {
    manager.addMessageHandler(type, handler);
  }
};

export function useWebSocket(orgId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const connect = useCallback(async () => {
    try {
      // For authenticated connections, we need both orgId and token
      if (orgId) {
        if (!getToken) {
          throw new Error('getToken function not available');
        }

        const token = await getToken({
          template: 'org-jwt',
        });

        if (!token) {
          throw new Error('No token available');
        }

        const ws = new WebSocket(
          `${import.meta.env.VITE_WS_URL}/ws/status/${orgId}/?token=${token}`
        );
        wsRef.current = ws;
      } else {
        // For public status updates
        const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/ws/status/public/`);
        wsRef.current = ws;
      }

      const ws = wsRef.current;
      if (!ws) return;

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        toast.success('Real-time updates connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'service_status_update':
              queryClient.invalidateQueries({ queryKey: ['services'] });
              toast.success('Service status updated');
              break;

            case 'incident_update':
              queryClient.invalidateQueries({ queryKey: ['incidents'] });
              toast.success('New incident update');
              break;

            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          toast.error('Failed to process real-time update');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        wsRef.current = null;

        if (event.wasClean) {
          toast('Real-time updates disconnected');
          return;
        }

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          toast.error(
            `Connection lost. Reconnecting... (Attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS})`
          );
          setTimeout(
            () => {
              reconnectAttempts.current += 1;
              connect();
            },
            RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts.current)
          );
        } else {
          toast.error('Failed to reconnect. Please refresh the page.');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection error occurred');
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      toast.error('Failed to establish real-time connection');
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [orgId, getToken, queryClient]);

  useEffect(() => {
    let mounted = true;

    const initConnection = async () => {
      const cleanup = await connect();
      if (mounted && cleanup) {
        return cleanup;
      }
    };

    initConnection();

    return () => {
      mounted = false;
      reconnectAttempts.current = 0;
    };
  }, [connect]);

  return wsRef.current;
}

export function sendWebSocketMessage(ws: WebSocket | null, message: WebSocketMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast.error('Not connected to real-time updates');
    return;
  }

  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
    toast.error('Failed to send update');
  }
}

class PublicWebSocketManager {
  private ws: WebSocket | null = null;
  private orgSlug: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private handlers: WebSocketMessageHandlers = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(orgSlug: string) {
    this.orgSlug = orgSlug;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting');
      return;
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/status/public/${this.orgSlug}/`;
    console.log(`Attempting to connect to WebSocket URL: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`Public WebSocket connected for org: ${this.orgSlug}`);
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
        toast.success('Connected to real-time updates');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`Received WebSocket message:`, message);
          const handler = this.handlers[message.type as keyof WebSocketMessageHandlers];

          if (handler) {
            handler(message.data);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Public WebSocket error:', error, 'URL:', wsUrl);
      };

      this.ws.onclose = (event) => {
        console.log(
          `Public WebSocket disconnected for org: ${this.orgSlug}`,
          event.code,
          event.reason
        );
        this.ws = null;

        if (event.wasClean) {
          toast('Real-time updates disconnected');
          return;
        }

        this.handleReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      toast.error('Failed to establish connection');
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(
        `Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${this.reconnectTimeout}ms`
      );

      this.reconnectTimer = setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
        );
        this.connect();
        this.reconnectAttempts++;
        this.reconnectTimeout *= 2; // Exponential backoff
      }, this.reconnectTimeout);

      toast.error(
        `Connection lost. Reconnecting... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
      );
    } else {
      toast.error('Failed to reconnect. Please refresh the page.');
    }
  }

  addMessageHandler<T extends keyof WebSocketMessageHandlers>(
    type: T,
    handler: NonNullable<WebSocketMessageHandlers[T]>
  ) {
    this.handlers[type] = handler;
  }

  removeMessageHandler(type: keyof WebSocketMessageHandlers) {
    delete this.handlers[type];
  }

  disconnect() {
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Keep track of public WebSocket connections
let publicWebSocketManager: PublicWebSocketManager | null = null;

export function initializePublicWebSocket(orgSlug: string) {
  if (publicWebSocketManager) {
    publicWebSocketManager.disconnect();
  }
  publicWebSocketManager = new PublicWebSocketManager(orgSlug);
  publicWebSocketManager.connect();
  return publicWebSocketManager;
}

export function disconnectPublicWebSocket() {
  if (publicWebSocketManager) {
    publicWebSocketManager.disconnect();
    publicWebSocketManager = null;
  }
}

export function getPublicWebSocketManager() {
  return publicWebSocketManager;
}

// Add a hook to use public WebSocket
export function usePublicWebSocket(orgSlug: string) {
  useEffect(() => {
    if (!orgSlug) {
      console.warn('No orgSlug provided to usePublicWebSocket');
      return;
    }

    console.log(`Initializing public WebSocket for org: ${orgSlug}`);
    initializePublicWebSocket(orgSlug);

    // Only clean up when the component is actually unmounting
    return () => {
      // Check if we're navigating away or the component is truly unmounting
      const isNavigatingAway = !window.location.pathname.includes(orgSlug);
      if (isNavigatingAway) {
        console.log(`Cleaning up public WebSocket for org: ${orgSlug}`);
        disconnectPublicWebSocket();
      }
    };
  }, [orgSlug]); // Only reinitialize if orgSlug changes
}
