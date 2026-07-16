import Echo from "laravel-echo";
import Pusher from "pusher-js";

let echoInstance: Echo<"pusher"> | null = null;
let echoToken: string | null = null;
let activeConsumers = 0;

function createEcho(token: string) {
  const wsScheme = (import.meta.env.VITE_WS_SCHEME ?? "https").toLowerCase();
  const wsPort = Number(import.meta.env.VITE_WS_PORT ?? (wsScheme === "https" ? 443 : 80));
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

  return new Echo({
    broadcaster: "pusher",
    client: new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: "mt1",
      wsHost: import.meta.env.VITE_WS_HOST,
      wsPort,
      wssPort: wsPort,
      forceTLS: wsScheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    })
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

export function releaseEchoClient() {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers === 0 && echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    echoToken = null;
  }
}

