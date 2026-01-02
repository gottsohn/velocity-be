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
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);
  const isStreamClosedRef = useRef(false);
  const isMountedRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  // Check if stream exists and is not deleted before connecting
  const checkStreamStatus = useCallback(async (): Promise<boolean> => {
    if (!streamId) return false;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/streams/${streamId}`);
      
      if (response.status === 404) {
        setError('Stream not found');
        setStatus('error');
        return false;
      }
      
      if (response.status === 410) {
        setIsStreamClosed(true);
        isStreamClosedRef.current = true;
        setStatus('closed');
        setError('This stream has been closed by the broadcaster');
        return false;
      }
      
      const data = await response.json();
      
      if (data.deletedAt) {
        setIsStreamClosed(true);
        isStreamClosedRef.current = true;
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

    // Check if component is still mounted (handles StrictMode cleanup)
    if (!isMountedRef.current) {
      return;
    }

    if (isStreamClosedRef.current) {
      return; // Don't reconnect if stream is closed
    }

    // Prevent duplicate connection attempts
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;
    setStatus('connecting');
    setError(null);

    // Check stream status before connecting
    const canConnect = await checkStreamStatus();
    
    // Re-check mounted state after async operation
    if (!isMountedRef.current) {
      isConnectingRef.current = false;
      return;
    }
    
    if (!canConnect) {
      isConnectingRef.current = false;
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(`${wsUrl}/ws/viewer/${streamId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setStatus('connected');
        setError(null);
        setIsStreamClosed(false);
        isStreamClosedRef.current = false;
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
            // Stream was closed while connected
            setIsStreamClosed(true);
            isStreamClosedRef.current = true;
            setStatus('closed');
            setError('This stream has been closed by the broadcaster');
            ws.close();
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
        if (!isMountedRef.current) return;
        setError('WebSocket connection error');
        setStatus('error');
      };

      ws.onclose = async (event) => {
        isConnectingRef.current = false;
        wsRef.current = null;
        
        if (!isMountedRef.current) return;

        // Check if stream was closed (code 1000 with specific reason or server-initiated close)
        if (event.code === 1000 || event.code === 1001) {
          // Check if stream is now deleted
          const streamStillValid = await checkStreamStatus();
          if (!streamStillValid || !isMountedRef.current) {
            return; // Stream is closed or unmounted, don't reconnect
          }
        }

        if (!isStreamClosedRef.current && isMountedRef.current) {
          setStatus('disconnected');
          
          // Auto-reconnect with exponential backoff
          if (reconnectAttempts.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
               
              connectRef.current();
            }, delay);
          }
        }
      };
    } catch {
      isConnectingRef.current = false;
      setError('Failed to create WebSocket connection');
      setStatus('error');
    }
  }, [streamId, checkStreamStatus]);

  // Keep the ref updated with the latest connect function (in an effect to avoid lint errors)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
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
    isStreamClosedRef.current = false;
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;
    isConnectingRef.current = false;
    isStreamClosedRef.current = false;
    
    // Defer connection to handle React StrictMode double-mounting
    // The first mount's timeout gets cancelled during cleanup,
    // so only the second mount's connection actually executes
    connectTimeoutRef.current = setTimeout(() => {
      connectRef.current();
    }, 0);

    return () => {
      // Mark as unmounted first to prevent any async operations from proceeding
      isMountedRef.current = false;
      
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
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
  }, [streamId]);

  return { streamData, status, error, reconnect, isStreamClosed };
}
