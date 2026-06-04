/**
 * context/RealtimeContext.jsx — Global real-time event context
 * Manages WebSocket connection, notification state, and event dispatching.
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Listeners registered by individual pages (e.g., Dashboard listens for attendance_update)
  const listenersRef = useRef({});

  const handleMessage = useCallback((parsed) => {
    const { event, data } = parsed;
    if (!event || event === "connected" || event === "pong") return;

    // Build a human-readable notification
    let title = "";
    let toastType = "default";

    if (event === "attendance_update") {
      if (data.action === "clock_in") {
        title = `${data.employee_name} clocked in`;
        toastType = "success";
      } else if (data.action === "clock_out") {
        title = `${data.employee_name} clocked out (${data.hours_worked}h)`;
        toastType = "default";
      }
    } else if (event === "leave_update") {
      if (data.action === "approved") {
        title = data.message || `Leave approved`;
        toastType = "success";
      } else if (data.action === "rejected") {
        title = data.message || `Leave rejected`;
        toastType = "error";
      }
    } else if (event === "employee_added") {
      title = `New employee added: ${data.employee_name}`;
      toastType = "success";
    } else if (event === "notification") {
      title = data.message || "New notification";
      toastType = data.type || "default";
    }

    if (title) {
      // Show toast
      if (toastType === "success") toast.success(title, { duration: 4000 });
      else if (toastType === "error") toast.error(title, { duration: 5000 });
      else toast(title, { duration: 3500 });

      // Add to notification list
      const notification = {
        id: Date.now(),
        event,
        title,
        data,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
      setUnreadCount((prev) => prev + 1);
    }

    // Fire any registered listeners for this event
    const handlers = listenersRef.current[event] || [];
    handlers.forEach((fn) => fn(data));
  }, []);

  const { status } = useWebSocket({
    token,
    onMessage: handleMessage,
    enabled: !!token,
  });

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  /** Register a listener for a specific event type. Returns cleanup fn. */
  const subscribe = useCallback((eventType, handler) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = [];
    }
    listenersRef.current[eventType].push(handler);
    return () => {
      listenersRef.current[eventType] = (
        listenersRef.current[eventType] || []
      ).filter((fn) => fn !== handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{ status, notifications, unreadCount, markAllRead, subscribe }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
