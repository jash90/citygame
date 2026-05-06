'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { GameBlueprint } from '@citygame/shared';

interface BlueprintTasksMapProps {
  blueprint: GameBlueprint;
  /** Called whenever the admin drags a marker. Receives a fully-updated blueprint. */
  onChange: (next: GameBlueprint) => void;
  /** Bounce the marker icon size when this index is set (e.g. card-hover sync). */
  highlightedIndex?: number | null;
  height?: number;
}

function buildIcon(index: number, highlighted: boolean): L.DivIcon {
  const size = highlighted ? 34 : 28;
  const ring = highlighted
    ? 'box-shadow:0 0 0 4px rgba(255,107,53,0.25),0 2px 6px rgba(0,0,0,0.3);'
    : 'box-shadow:0 2px 6px rgba(0,0,0,0.3);';
  return new L.DivIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#FF6B35;color:white;border:2px solid white;
      ${ring}
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;cursor:grab;
      user-select:none;
    ">${index}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBoundsOnce({ tasks }: { tasks: GameBlueprint['tasks'] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || tasks.length === 0) return;
    const points = tasks.map(
      (t) => [t.latitude, t.longitude] as L.LatLngTuple,
    );
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    didFit.current = true;
  }, [tasks, map]);
  return null;
}

export function BlueprintTasksMap({
  blueprint,
  onChange,
  highlightedIndex = null,
  height = 380,
}: BlueprintTasksMapProps) {
  const center = useMemo<L.LatLngExpression>(() => {
    const t = blueprint.tasks[0];
    return t ? [t.latitude, t.longitude] : [52.2297, 21.0122];
  }, [blueprint.tasks]);

  const handleDragEnd = (taskIndex: number, lat: number, lon: number) => {
    onChange({
      ...blueprint,
      tasks: blueprint.tasks.map((t) =>
        t.index === taskIndex
          ? { ...t, latitude: round5(lat), longitude: round5(lon) }
          : t,
      ),
    });
  };

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnce tasks={blueprint.tasks} />
        {blueprint.tasks.map((task) => (
          <Marker
            key={task.index}
            position={[task.latitude, task.longitude]}
            draggable
            icon={buildIcon(task.index, highlightedIndex === task.index)}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const { lat, lng } = marker.getLatLng();
                handleDragEnd(task.index, lat, lng);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold">
                  #{task.index} · {task.type}
                </span>
                <span className="text-xs">{task.title}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {task.latitude.toFixed(5)}, {task.longitude.toFixed(5)}
                </span>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
