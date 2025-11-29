//src/components/MapInner.tsx  //actual leaflet map logic and visit markers
'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { RoutePlanData, ModelInput } from '@/types/timefold';

//small helper type for map points derived from visits
interface VisitPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicleId: string | null; //used to color points per technician
}

//palette and helpers, same color scheme as scheduler view
const palette = [
  '#16a34a', //green
  '#4f46e5', //indigo
  '#2563eb', //blue
  '#0d9488', //teal
  '#ea580c', //orange
  '#7c3aed', //purple
  '#db2777', //pink
  '#ca8a04', //amber
  '#dc2626', //red
  '#0891b2', //cyan
];

//simple hash so each key maps to a stable index in the palette
function colorIndexForKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % palette.length;
}

//resolve the final color for a vehicle id (or gray when unassigned)
function colorForKey(key: string | null): string {
  if (!key) return '#64748b'; //gray used when visit is not assigned
  return palette[colorIndexForKey(key)];
}

//build visit points and a simple map center from the model input
function buildVisitPoints(modelInput: ModelInput | null): {
  points: VisitPoint[];
  center: [number, number] | null;
} {
  if (!modelInput) {
    //no underlying model means no coordinates to show
    return { points: [], center: null };
  }

  //map shiftId -> vehicleId so we can group and color by technician
  const shiftToVehicle = new Map<string, string>();
  for (const vehicle of modelInput.vehicles ?? []) {
    for (const shift of vehicle.shifts ?? []) {
      shiftToVehicle.set(shift.id, vehicle.id);
    }
  }

  const points: VisitPoint[] = [];
  const lats: number[] = [];
  const lngs: number[] = [];

  for (const visit of modelInput.visits ?? []) {
    //in this assignment, location is stored as [lat, lng] on each visit
    const loc = (visit as any).location;

    if (
      !Array.isArray(loc) ||
      loc.length !== 2 ||
      typeof loc[0] !== 'number' ||
      typeof loc[1] !== 'number'
    ) {
      //skip visits that do not expose proper coordinates
      continue;
    }

    const [lat, lng] = loc;

    //lookup the technician behind the assigned shift id, if any
    const vehicleId =
      visit.assignedVehicleShiftId
        ? shiftToVehicle.get(visit.assignedVehicleShiftId) ?? null
        : null;

    points.push({
      id: visit.id,
      name: visit.name ?? visit.id,
      lat,
      lng,
      vehicleId,
    });

    lats.push(lat);
    lngs.push(lng);
  }

  if (!points.length) {
    //no valid visits means we cannot compute a center
    return { points, center: null };
  }

  //simple centroid for initial view (not the same as real bounding fit)
  const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  return {
    points,
    center: [avgLat, avgLng],
  };
}

interface MapInnerProps {
  routePlan: RoutePlanData | null; //baseline or optimized data from the page
}

export default function MapInner({ routePlan }: MapInnerProps) {
  //memoize conversion so we do not rebuild markers on every render
  const { points, center } = useMemo(
    () => buildVisitPoints(routePlan?.modelInput ?? null),
    [routePlan],
  );

  if (!routePlan) {
    //user has not loaded demo data yet
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
        Load demo data to see visits on the map.
      </div>
    );
  }

  if (!points.length || !center) {
    //no usable coordinate data found for any visit
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
        No visits with valid coordinates to display.
      </div>
    );
  }

  //MAIN map container, responsible for rendering tiles and markers
  return (
    <MapContainer
      center={center}
      zoom={11}
      className="h-full w-full"
      scrollWheelZoom={false} //helps avoid the map hijacking normal page scroll
    >
      {/*base map layer provided by openstreetmap*/}
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/*render each visit as a colored circle marker on the map*/}
      {points.map((p) => {
        const color = colorForKey(p.vehicleId);

        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85, //slightly higher so markers stand out more
            }}
          >
            {/*popup shows basic visit information and coordinates*/}
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{p.name}</div>
                {p.vehicleId && <div>Technician: {p.vehicleId}</div>}
                <div>
                  Lat: {p.lat.toFixed(4)}, Lng:{p.lng.toFixed(4)} {/*intentional missingspace*/}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
