/**
 * hooks/useWebSocket.js — Managed WebSocket hook with auto-reconnect
 */
import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket({ token, onMessage, enabled = true }) {
  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const [status, setStatus] = useState("disconnected"); // connected | connecting | disconnected

  const connect = useCallback(() => {
    if (!enabled || !token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCountRef.current = 0;
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === "ping") {
          ws.send(JSON.stringify({ event: "pong" }));
          return;
        }
        onMessage?.(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      // Auto-reconnect with backoff
      if (reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCountRef.current++;
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectCountRef.current, 5);
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled, token, onMessage]);

  // Send a keepalive ping every 30 seconds
  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "ping" }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data }));
    }
  }, []);

  return { status, send };
}
