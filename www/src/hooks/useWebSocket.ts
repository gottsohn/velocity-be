import { useState, useEffect, useRef, useCallback } from 'react';
import type { StreamData, WebSocketMessage, ConnectionStatus } from '../types/stream';

// Use relative URLs to go through Vite proxy (or same origin in production)
const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // Use current host with appropriate WebSocket protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Use relative URL to go through proxy
  return '';
};

interface UseWebSocketResult {
  streamData: StreamData | null;
  status: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
  isStreamClosed: boolean;
}

export function useWebSocket(streamId: string | null): UseWebSocketResult {
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isStreamClosed, setIsStreamClosed] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const connectRef = useRef<() => void>();

  // Check if stream exists and is not deleted before connecting
  const checkStreamStatus = useCallback(async (): Promise<boolean> => {
    if (!streamId) return false;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/streams/${streamId}`);
      
      if (!isMountedRef.current) return false;
      
      if (response.status === 404) {
        setError('Stream not found');
        setStatus('error');
        return false;
      }
      
      if (response.status === 410) {
        setIsStreamClosed(true);
        setStatus('closed');
        setError('This stream has been closed by the broadcaster');
        return false;
      }
      
      const data = await response.json();
      
      if (data.deletedAt) {
        setIsStreamClosed(true);
        setStatus('closed');
        setError('This stream has been closed by the broadcaster');
        return false;
      }
      
      return true;
    } catch (e) {
      console.error('Error checking stream status:', e);
      return true; // Allow connection attempt even if check fails
    }
  }, [streamId]);

  const connect = useCallback(async () => {
    if (!streamId) {
      setError('No stream ID provided');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    // Don't connect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;
    setStatus('connecting');
    setError(null);

    // Check stream status before connecting
    const canConnect = await checkStreamStatus();
    if (!canConnect || !isMountedRef.current) {
      isConnectingRef.current = false;
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(`${wsUrl}/ws/viewer/${streamId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        isConnectingRef.current = false;
        setStatus('connected');
        setError(null);
        setIsStreamClosed(false);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected to stream:', streamId);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'stream_data') {
            setStreamData(message.payload as StreamData);
          } else if (message.type === 'error') {
            const payload = message.payload as { message: string };
            setError(payload.message);
          } else if (message.type === 'stream_closed') {
            setIsStreamClosed(true);
            setStatus('closed');
            setError('This stream has been closed by the broadcaster');
            ws.close();
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        isConnectingRef.current = false;
        setError('WebSocket connection error');
        setStatus('error');
      };

      ws.onclose = async () => {
        isConnectingRef.current = false;
        wsRef.current = null;

        if (!isMountedRef.current) return;

        // Check if stream is now deleted
        const streamStillValid = await checkStreamStatus();
        if (!streamStillValid || !isMountedRef.current) {
          return;
        }

        setStatus('disconnected');
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttempts.current++;
              connectRef.current?.();
            }
          }, delay);
        }
      };
    } catch {
      isConnectingRef.current = false;
      setError('Failed to create WebSocket connection');
      setStatus('error');
    }
  }, [streamId, checkStreamStatus]);

  // Keep ref in sync with latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    isConnectingRef.current = false;
    setIsStreamClosed(false);
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Small delay to handle StrictMode double-mount
    const connectTimeout = setTimeout(() => {
      if (isMountedRef.current && streamId) {
        connect();
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimeout);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [streamId, connect]);

  return { streamData, status, error, reconnect, isStreamClosed };
}
