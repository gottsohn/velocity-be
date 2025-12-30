import { useState, useEffect, useRef, useCallback } from 'react';
import type { StreamData, WebSocketMessage, ConnectionStatus } from '../types/stream';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

interface UseWebSocketResult {
  streamData: StreamData | null;
  status: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

export function useWebSocket(streamId: string | null): UseWebSocketResult {
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!streamId) {
      setError('No stream ID provided');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(`${WS_URL}/ws/viewer/${streamId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
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
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
    } catch (e) {
      setError('Failed to create WebSocket connection');
      setStatus('error');
    }
  }, [streamId]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
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

  return { streamData, status, error, reconnect };
}
