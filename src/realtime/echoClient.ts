import Echo from "laravel-echo";
import Pusher from "pusher-js";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

window.Pusher = Pusher;

let echoInstance: Echo<"pusher"> | null = null;
let echoToken: string | null = null;
let activeConsumers = 0;

function createEcho(token: string) {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const key = import.meta.env.VITE_PUSHER_KEY || "";
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER || "ap2";
  const customHost = (import.meta.env.VITE_WS_HOST || "").trim();
  const useCustomSocket =
    Boolean(customHost) && customHost !== "127.0.0.1" && customHost !== "localhost";

  if (!key) {
    console.warn("[realtime] VITE_PUSHER_KEY missing — booking beep will not work");
  }

  const auth = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  };

  // Hostinger shared hosting: use Pusher Cloud (no local websocket server).
  if (!useCustomSocket) {
    return new Echo({
      broadcaster: "pusher",
      key,
      cluster,
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
      authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
      auth
    });
  }

  const wsScheme = (import.meta.env.VITE_WS_SCHEME ?? "https").toLowerCase();
  const wsPort = Number(import.meta.env.VITE_WS_PORT ?? (wsScheme === "https" ? 443 : 80));

  return new Echo({
    broadcaster: "pusher",
    key,
    cluster,
    wsHost: customHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: wsScheme === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
    auth
  });
}

export function acquireEchoClient(token: string) {
  if (!token) return null;
  if (!echoInstance || echoToken !== token) {
    if (echoInstance) {
      echoInstance.disconnect();
    }
    echoInstance = createEcho(token);
    echoToken = token;
  }
  activeConsumers += 1;
  return echoInstance;
}

/** True when other hooks still need the shared Echo connection. */
export function releaseEchoClient() {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers === 0 && echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    echoToken = null;
    return true;
  }
  return false;
}

export function getEchoConsumerCount() {
  return activeConsumers;
}
