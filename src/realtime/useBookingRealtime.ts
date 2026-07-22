import { useEffect, useMemo, useRef, useState } from "react";
import type { BookingItem, UserRole } from "../types";
import { acquireEchoClient, getEchoConsumerCount, releaseEchoClient } from "./echoClient";

export interface BookingRealtimePayload {
  booking_id: number;
  customer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  services?: string;
  branch_id?: number;
  created_at?: string;
  status?: string;
}

interface UseBookingRealtimeParams {
  token: string | null;
  role?: UserRole;
  branchId?: number | null;
  onBookingCreated?: (booking: BookingItem, payload: BookingRealtimePayload) => void;
}

interface BookingRealtimeState {
  isConnected: boolean;
  connectionState: string;
  subscribedChannels: string[];
  lastEventAt: string | null;
}

function toBookingItem(payload: BookingRealtimePayload): BookingItem {
  return {
    id: Number(payload.booking_id),
    name: payload.customer_name,
    email: "",
    phone: "",
    date: payload.date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    services: payload.services ?? "",
    status: payload.status ?? "Pending",
    branch_id: payload.branch_id
  };
}

function resolveChannels(role?: UserRole, branchId?: number | null) {
  if (!role) return [] as string[];
  if (role === "admin") {
    const channels = ["bookings.global"];
    if (branchId != null) channels.push(`bookings.branch.${branchId}`);
    return channels;
  }
  if (role === "manager" || role === "branch_manager") {
    if (branchId == null) return [];
    return [`bookings.branch.${branchId}`];
  }
  return [];
}

export function useBookingRealtime({
  token,
  role,
  branchId,
  onBookingCreated
}: UseBookingRealtimeParams): BookingRealtimeState {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  const channelNames = useMemo(() => resolveChannels(role, branchId), [role, branchId]);
  const channelKey = channelNames.join("|");
  const onBookingCreatedRef = useRef(onBookingCreated);

  useEffect(() => {
    onBookingCreatedRef.current = onBookingCreated;
  }, [onBookingCreated]);

  useEffect(() => {
    if (!token || channelNames.length === 0) {
      setIsConnected(false);
      setConnectionState("disconnected");
      setSubscribedChannels([]);
      return;
    }

    const echo = acquireEchoClient(token);
    if (!echo) return;
    const pusherConnection = echo.connector.pusher.connection;

    const handleConnected = () => {
      setIsConnected(true);
      setConnectionState("connected");
    };
    const handleDisconnected = () => {
      setIsConnected(false);
      setConnectionState("disconnected");
    };
    const handleStateChange = (states: { current: string }) => {
      setConnectionState(states.current);
      setIsConnected(states.current === "connected");
    };
    const handleError = (err: unknown) => {
      console.warn("[realtime] pusher error", err);
    };

    pusherConnection.bind("connected", handleConnected);
    pusherConnection.bind("disconnected", handleDisconnected);
    pusherConnection.bind("state_change", handleStateChange);
    pusherConnection.bind("error", handleError);
    setConnectionState(pusherConnection.state);
    setIsConnected(pusherConnection.state === "connected");

    const receivedAt = () => new Date().toISOString();
    const privateNames = channelNames.map((channelName) => `private-${channelName}`);
    setSubscribedChannels(privateNames);

    const handler = (payload: BookingRealtimePayload) => {
      setLastEventAt(receivedAt());
      const booking = toBookingItem(payload);
      onBookingCreatedRef.current?.(booking, payload);
    };

    channelNames.forEach((channelName) => {
      echo.private(channelName).listen(".BookingCreated", handler);
    });

    return () => {
      channelNames.forEach((channelName) => {
        try {
          echo.private(channelName).stopListening(".BookingCreated", handler);
        } catch {
          // Channel may already be gone during disconnect.
        }
      });

      pusherConnection.unbind("connected", handleConnected);
      pusherConnection.unbind("disconnected", handleDisconnected);
      pusherConnection.unbind("state_change", handleStateChange);
      pusherConnection.unbind("error", handleError);

      // Only disconnect when no other page/layout still needs Echo.
      // Leaving channels here used to kill the AppLayout beep listener.
      const fullyReleased = releaseEchoClient();
      if (!fullyReleased && getEchoConsumerCount() > 0) {
        // Shared connection kept alive for remaining consumers.
      }
    };
  }, [token, channelKey]);

  return {
    isConnected,
    connectionState,
    subscribedChannels,
    lastEventAt
  };
}
