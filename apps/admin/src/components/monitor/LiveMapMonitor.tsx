'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Marker icons ──────────────────────────────────────────────────────────────

const taskIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:#FF6B35;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const playerIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#3b82f6;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskLocation {
  taskId: string;
  title: string;
  latitude: number;
  longitude: number;
  activePlayerCount: number;
}

export interface PlayerLocation {
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
}

interface LiveMapMonitorProps {
  tasks: TaskLocation[];
  players: PlayerLocation[];
}

// ── Auto-fit bounds ───────────────────────────────────────────────────────────

function FitBounds({
  tasks,
  players,
}: {
  tasks: TaskLocation[];
  players: PlayerLocation[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLngExpression[] = [
      ...tasks.map((t) => [t.latitude, t.longitude] as L.LatLngTuple),
      ...players.map((p) => [p.latitude, p.longitude] as L.LatLngTuple),
    ];

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [tasks, players, map]);

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveMapMonitor({ tasks, players }: LiveMapMonitorProps) {
  const center = useMemo<L.LatLngTuple>(() => {
    const allPoints = [
      ...tasks.map((t) => ({ lat: t.latitude, lng: t.longitude })),
      ...players.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    ];

    if (allPoints.length === 0) return [52.23, 21.01]; // Default: Warsaw

    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [tasks, players]);

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds tasks={tasks} players={players} />

      {/* Task markers */}
      {tasks.map((task) => (
        <Marker
          key={`task-${task.taskId}`}
          position={[task.latitude, task.longitude]}
          icon={taskIcon}
        >
          <Popup>
            <div className="text-xs">
              <strong>{task.title}</strong>
              {task.activePlayerCount > 0 && (
                <p className="mt-1 text-gray-500">
                  {task.activePlayerCount} graczy w pobliżu
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Player markers */}
      {players.map((player) => (
        <Marker
          key={`player-${player.userId}`}
          position={[player.latitude, player.longitude]}
          icon={playerIcon}
        >
          <Popup>
            <div className="text-xs">
              <strong>{player.displayName}</strong>
              {player.accuracy != null && (
                <p className="text-gray-400">±{Math.round(player.accuracy)}m</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
