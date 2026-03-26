import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let rankingSocket: Socket | null = null;

export function getRankingSocket(): Socket {
  if (!rankingSocket) {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    rankingSocket = io(`${WS_URL}/ranking`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }

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
  if (rankingSocket?.connected) {
    rankingSocket.disconnect();
  }
}
