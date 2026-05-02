'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Crosshair, X, Maximize2 } from 'lucide-react';

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

function buildPlayerIcon(highlighted: boolean): L.DivIcon {
  const size = highlighted ? 18 : 12;
  const ring = highlighted
    ? 'box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 1px 4px rgba(0,0,0,0.3);'
    : 'box-shadow:0 1px 4px rgba(0,0,0,0.3);';
  return new L.DivIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#3b82f6;border:2px solid #fff;${ring}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

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

const FOLLOW_ZOOM = 18;

function fitToPoints(map: L.Map, tasks: TaskLocation[], players: PlayerLocation[]): boolean {
  const points: L.LatLngExpression[] = [
    ...tasks.map((t) => [t.latitude, t.longitude] as L.LatLngTuple),
    ...players.map((p) => [p.latitude, p.longitude] as L.LatLngTuple),
  ];
  if (points.length === 0) return false;
  map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 });
  return true;
}

function InitialFitBounds({
  tasks,
  players,
  enabled,
}: {
  tasks: TaskLocation[];
  players: PlayerLocation[];
  enabled: boolean;
}) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    if (!enabled) {
      didFit.current = false;
      return;
    }
    if (didFit.current) return;
    if (fitToPoints(map, tasks, players)) {
      didFit.current = true;
    }
  }, [tasks, players, map, enabled]);

  return null;
}

function FollowPlayer({ player }: { player: PlayerLocation | null }) {
  const map = useMap();
  const lastUserId = useRef<string | null>(null);
  const lastPosKey = useRef<string | null>(null);

  useEffect(() => {
    if (!player) {
      lastUserId.current = null;
      lastPosKey.current = null;
      return;
    }
    const posKey = `${player.latitude.toFixed(6)}:${player.longitude.toFixed(6)}`;
    if (player.userId === lastUserId.current && posKey === lastPosKey.current) return;

    const target: L.LatLngTuple = [player.latitude, player.longitude];
    const isNewFollow = player.userId !== lastUserId.current;

    if (isNewFollow) {
      const targetZoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
      map.setView(target, targetZoom, { animate: true });
    } else {
      map.panTo(target, { animate: true });
    }

    lastUserId.current = player.userId;
    lastPosKey.current = posKey;
  }, [player, map]);

  return null;
}

function ZoomControls({
  followingId,
  onClearFollow,
  tasks,
  players,
}: {
  followingId: string | null;
  onClearFollow: () => void;
  tasks: TaskLocation[];
  players: PlayerLocation[];
}) {
  const map = useMap();

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1">
      <button
        type="button"
        aria-label="Przybliż"
        onClick={() => map.zoomIn()}
        className="w-9 h-9 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 text-gray-700"
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        aria-label="Oddal"
        onClick={() => map.zoomOut()}
        className="w-9 h-9 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 text-gray-700"
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        aria-label="Pokaż wszystko"
        title="Pokaż wszystkie punkty"
        onClick={() => fitToPoints(map, tasks, players)}
        className="w-9 h-9 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 text-gray-700"
      >
        <Maximize2 size={14} />
      </button>
      {followingId && (
        <button
          type="button"
          aria-label="Przestań śledzić"
          onClick={onClearFollow}
          className="w-9 h-9 rounded-md bg-blue-500 border border-blue-600 shadow-sm flex items-center justify-center hover:bg-blue-600 text-white"
          title="Przestań śledzić gracza"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function LiveMapMonitor({ tasks, players }: LiveMapMonitorProps) {
  const [followingId, setFollowingId] = useState<string | null>(null);

  const center = useMemo<L.LatLngTuple>(() => {
    const allPoints = [
      ...tasks.map((t) => ({ lat: t.latitude, lng: t.longitude })),
      ...players.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    ];
    if (allPoints.length === 0) return [52.23, 21.01];
    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [tasks, players]);

  const followedPlayer = useMemo(
    () => (followingId ? players.find((p) => p.userId === followingId) ?? null : null),
    [followingId, players],
  );

  useEffect(() => {
    if (followingId && !players.some((p) => p.userId === followingId)) {
      setFollowingId(null);
    }
  }, [followingId, players]);

  return (
    <div className="relative w-full h-full">
      {players.length > 0 && (
        <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2 max-w-[60%]">
          <Crosshair size={14} className="text-gray-500 shrink-0" />
          <select
            value={followingId ?? ''}
            onChange={(e) => setFollowingId(e.target.value || null)}
            className="bg-white border border-gray-200 shadow-sm rounded-md text-xs px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-full truncate"
          >
            <option value="">Śledź gracza…</option>
            {players.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <InitialFitBounds tasks={tasks} players={players} enabled={!followingId} />
        <FollowPlayer player={followedPlayer} />
        <ZoomControls
          followingId={followingId}
          onClearFollow={() => setFollowingId(null)}
          tasks={tasks}
          players={players}
        />

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

        {players.map((player) => {
          const isFollowed = followingId === player.userId;
          return (
            <Marker
              key={`player-${player.userId}`}
              position={[player.latitude, player.longitude]}
              icon={buildPlayerIcon(isFollowed)}
              eventHandlers={{
                click: () => setFollowingId(isFollowed ? null : player.userId),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{player.displayName}</strong>
                  {player.accuracy != null && (
                    <p className="text-gray-400">±{Math.round(player.accuracy)}m</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setFollowingId(isFollowed ? null : player.userId)}
                    className="mt-1 text-blue-600 hover:underline"
                  >
                    {isFollowed ? 'Przestań śledzić' : 'Śledź gracza'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
