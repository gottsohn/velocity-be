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

    if (isStreamClosed) {
      return; // Don't reconnect if stream is closed
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);

    // Check stream status before connecting
    const canConnect = await checkStreamStatus();
    if (!canConnect) {
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(`${wsUrl}/ws/viewer/${streamId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        setIsStreamClosed(false);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected to stream:', streamId);
      };

      ws.onmessage = (event) => {
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
            setStatus('closed');
            setError('This stream has been closed by the broadcaster');
            ws.close();
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setStatus('error');
      };

      ws.onclose = async (event) => {
        wsRef.current = null;

        // Check if stream was closed (code 1000 with specific reason or server-initiated close)
        if (event.code === 1000 || event.code === 1001) {
          // Check if stream is now deleted
          const streamStillValid = await checkStreamStatus();
          if (!streamStillValid) {
            return; // Stream is closed, don't reconnect
          }
        }

        if (!isStreamClosed) {
          setStatus('disconnected');
          
          // Auto-reconnect with exponential backoff
          if (reconnectAttempts.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              connect();
            }, delay);
          }
        }
      };
    } catch (e) {
      setError('Failed to create WebSocket connection');
      setStatus('error');
    }
  }, [streamId, isStreamClosed, checkStreamStatus]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsStreamClosed(false);
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { streamData, status, error, reconnect, isStreamClosed };
}
