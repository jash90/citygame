import { io, type Socket } from 'socket.io-client';

// WebSocket connects directly to the backend host (NOT via Next.js rewrite),
// because Vercel cannot proxy WS upgrades to an external host. Falls back to
// NEXT_PUBLIC_API_URL, then relative URL (which works only when admin and
// backend share an origin, e.g. local dev with the backend on a tunnel).
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

// In dev, WS_URL stays relative so Next.js rewrites proxy /socket.io to the
// local backend (rewrites work for WS upgrades in `next dev`, just not on
// Vercel's serverless production runtime).

let rankingSocket: Socket | null = null;
let currentWsToken: string | null = null;

/**
 * Fetch a fresh access token for WS auth from the cookie-authenticated API.
 * The /api/auth/me endpoint validates the httpOnly cookie and returns user info.
 * We then use the access token that was refreshed by the cookie flow.
 */
async function fetchWsToken(): Promise<string | null> {
  try {
    // Refresh always goes through the admin proxy (relative URL) so the
    // first-party httpOnly cookie is included, regardless of where the WS
    // ultimately connects.
    const res = await fetch(`/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    if (!res.ok) return currentWsToken;
    const json = await res.json();
    const data = json?.data ?? json;
    if (data?.accessToken) {
      currentWsToken = data.accessToken;
      return data.accessToken;
    }
    return currentWsToken;
  } catch {
    return currentWsToken;
  }
}

/**
 * Set the WS token from the login response. Called by the login page
 * so the WebSocket can authenticate without reading localStorage.
 */
export function setWsToken(token: string): void {
  currentWsToken = token;
  // Update existing socket auth if already created
  if (rankingSocket) {
    (rankingSocket.auth as Record<string, unknown>).token = token;
  }
}

export function getRankingSocket(): Socket {
  if (rankingSocket) {
    // Update token if it changed (e.g. after re-login)
    if (currentWsToken) {
      (rankingSocket.auth as Record<string, unknown>).token = currentWsToken;
    }
    return rankingSocket;
  }

  // Use the callback form so the current token is re-read on every (re)connect
  // attempt. Mutating a plain auth object is not enough: socket.io evaluates
  // the function each time, so fresh tokens fetched after connect_error are
  // actually applied on retry.
  rankingSocket = io(`${WS_URL}/ranking`, {
    auth: (cb) => cb({ token: currentWsToken ?? '' }),
    transports: ['websocket'],
    autoConnect: false,
  });

  // On auth error, fetch a fresh token and explicitly reconnect.
  // Socket.io does not auto-retry an initial connect failure triggered by
  // middleware rejection, so we have to kick off another connect ourselves.
  let isRefreshing = false;
  rankingSocket.on('connect_error', async (err) => {
    if (
      err.message !== 'Authentication required' &&
      err.message !== 'Invalid authentication token'
    ) {
      return;
    }
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const freshToken = await fetchWsToken();
      if (freshToken && rankingSocket && !rankingSocket.connected) {
        rankingSocket.connect();
      }
    } finally {
      isRefreshing = false;
    }
  });

  return rankingSocket;
}

export function connectRankingSocket(): Socket {
  const socket = getRankingSocket();
  if (!socket.connected) {
    // If we don't have a token yet, fetch one first so the initial handshake
    // carries it — otherwise the first connect always fails.
    if (!currentWsToken) {
      void fetchWsToken().then(() => {
        if (socket && !socket.connected) socket.connect();
      });
    } else {
      socket.connect();
    }
  }
  return socket;
}

export function disconnectRankingSocket(): void {
  if (rankingSocket) {
    rankingSocket.disconnect();
    rankingSocket = null;
  }
}
