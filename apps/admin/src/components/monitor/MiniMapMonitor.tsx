'use client';

import { MapPin, Users } from 'lucide-react';

interface TaskLocation {
  taskId: string;
  title: string;
  latitude: number;
  longitude: number;
  activePlayerCount: number;
}

interface MiniMapMonitorProps {
  tasks: TaskLocation[];
  /** Bounding box for the map area — auto-derived if not provided */
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

function normalizeTo(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

export function MiniMapMonitor({ tasks, bounds }: MiniMapMonitorProps) {
  // Derive bounds from task locations if not provided
  const computedBounds = bounds ?? (() => {
    if (!tasks.length) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    const lats = tasks.map((t) => t.latitude);
    const lons = tasks.map((t) => t.longitude);
    const padding = 0.002; // ~200m of visual padding
    return {
      minLat: Math.min(...lats) - padding,
      maxLat: Math.max(...lats) + padding,
      minLon: Math.min(...lons) - padding,
      maxLon: Math.max(...lons) + padding,
    };
  })();

  return (
    <div className="flex flex-col h-full">
      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-4">
          <div className="w-full flex-1 min-h-[160px] rounded-lg bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200">
            <div className="text-center">
              <MapPin size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Brak danych lokalizacji</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative m-4 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 min-h-[160px]">
          {/* Simulated map grid lines */}
          <svg
            className="absolute inset-0 w-full h-full opacity-20"
            xmlns="http://www.w3.org/2000/svg"
          >
            {[25, 50, 75].map((pct) => (
              <g key={pct}>
                <line x1={`${pct}%`} y1="0" x2={`${pct}%`} y2="100%" stroke="#9ca3af" strokeWidth="1" />
                <line x1="0" y1={`${pct}%`} x2="100%" y2={`${pct}%`} stroke="#9ca3af" strokeWidth="1" />
              </g>
            ))}
          </svg>

          {/* Task dots */}
          {tasks.map((task) => {
            const x = normalizeTo(task.longitude, computedBounds.minLon, computedBounds.maxLon);
            // Invert Y: higher latitude = higher on screen
            const y = 100 - normalizeTo(task.latitude, computedBounds.minLat, computedBounds.maxLat);

            return (
              <div
                key={task.taskId}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {/* Player count bubble */}
                {task.activePlayerCount > 0 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#FF6B35] text-white text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    <Users size={9} />
                    {task.activePlayerCount}
                  </div>
                )}
                {/* Pin dot */}
                <div className="w-4 h-4 rounded-full bg-[#FF6B35] border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform" />
                {/* Tooltip */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg z-10">
                  {task.title}
                </div>
              </div>
            );
          })}

          {/* Corner label */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/70 px-1.5 py-0.5 rounded backdrop-blur-sm">
            Mapa orientacyjna
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center px-4 pb-3">
        Lokalizacje zadań i liczba aktywnych graczy w obszarze
      </p>
    </div>
  );
}
