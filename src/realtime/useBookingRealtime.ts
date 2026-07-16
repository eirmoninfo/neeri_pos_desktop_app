import { useEffect, useMemo, useRef, useState } from "react";
import type { BookingItem, UserRole } from "../types";
import { acquireEchoClient, releaseEchoClient } from "./echoClient";

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

    pusherConnection.bind("connected", handleConnected);
    pusherConnection.bind("disconnected", handleDisconnected);
    pusherConnection.bind("state_change", handleStateChange);

    const receivedAt = () => new Date().toISOString();
    const privateNames = channelNames.map((channelName) => `private-${channelName}`);
    setSubscribedChannels(privateNames);

    channelNames.forEach((channelName) => {
      echo
        .private(channelName)
        .listen(".BookingCreated", (payload: BookingRealtimePayload) => {
          setLastEventAt(receivedAt());
          const booking = toBookingItem(payload);
          onBookingCreatedRef.current?.(booking, payload);
        });
    });

    return () => {
      channelNames.forEach((channelName) => {
        echo.leave(`private-${channelName}`);
      });
      pusherConnection.unbind("connected", handleConnected);
      pusherConnection.unbind("disconnected", handleDisconnected);
      pusherConnection.unbind("state_change", handleStateChange);
      releaseEchoClient();
    };
  }, [token, channelKey]);

  return {
    isConnected,
    connectionState,
    subscribedChannels,
    lastEventAt
  };
}

