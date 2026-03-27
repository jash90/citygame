import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let rankingSocket: Socket | null = null;

export function getRankingSocket(): Socket {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  if (rankingSocket) {
    // Update token if it changed (e.g. after re-login)
    (rankingSocket.auth as Record<string, unknown>).token = token;
    return rankingSocket;
  }

  rankingSocket = io(`${WS_URL}/ranking`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: false,
  });

  return rankingSocket;
}

export function connectRankingSocket(): Socket {
  const socket = getRankingSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectRankingSocket(): void {
  if (rankingSocket) {
    rankingSocket.disconnect();
    rankingSocket = null;
  }
}
