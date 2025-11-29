//src/components/SchedulerView.tsx  //scheduler view that renders timefold data in bryntum
'use client';

import { useMemo } from 'react';
import type { RoutePlanData, ModelInput } from '@/types/timefold';
//use dynamic import so bryntum only loads on the client
import dynamic from 'next/dynamic';

//dynamically import bryntum so it only runs on client side, avoids ssr issues
const BryntumSchedulerPro = dynamic(
  () =>
    import('@bryntum/schedulerpro-react').then(
      (m) => m.BryntumSchedulerPro,
    ),
  { ssr: false },
);

//simple resource record used by bryntum scheduler
interface ResourceRecord {
  id: string;      //row id in scheduler (vehicle id or shift id depending on mode)
  name: string;    //technician name (may include shift label)
  vehicleId: string;
}

//small event structure that maps visits to time slots
//note: use Date objects so scheduler can work with them directly
interface EventRecord {
  id: string;
  resourceId: string; //row id (vehicle or shift, depending on mode)
  name: string;
  startDate: Date;
  endDate: Date;
}

//palette and helpers to give each technician a stable color
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

//simple hash based on resource id so each tech gets a repeatable index
function colorIndexForResource(resourceId: string): number {
  let hash = 0;
  for (let i = 0; i < resourceId.length; i++) {
    hash = (hash * 31 + resourceId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % palette.length;
}

//lookup actual hex color for a given resource id
function colorForResource(resourceId: string): string {
  return palette[colorIndexForResource(resourceId)];
}

//simple lightening helper for building gradients
function lighten(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));

  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

//-----------------------------------------------------------------------------
//resource / event builders
//shiftViewMode = 1  => one row per technician (vehicle)
//shiftViewMode > 1  => one row per shift (original behaviour, all shifts visible)
//-----------------------------------------------------------------------------

//technician view: one row per vehicle
function buildTechResources(modelInput: ModelInput): ResourceRecord[] {
  const resources: ResourceRecord[] = [];

  for (const vehicle of modelInput.vehicles ?? []) {
    resources.push({
      id: vehicle.id,                   //row id = vehicle
      name: vehicle.name ?? vehicle.id, //technician name
      vehicleId: vehicle.id,
    });
  }

  return resources;
}

//shift view: one row per shift (a vehicle may appear multiple times)
function buildShiftResources(modelInput: ModelInput): ResourceRecord[] {
  const resources: ResourceRecord[] = [];

  for (const vehicle of modelInput.vehicles ?? []) {
    for (const shift of vehicle.shifts ?? []) {
      resources.push({
        id: shift.id,                   //row id = shift
        name: vehicle.name ?? vehicle.id,
        vehicleId: vehicle.id,
      });
    }
  }

  return resources;
}

//technician view events: map all shift ids to the vehicle row
function buildTechEvents(modelInput: ModelInput): {
  events: EventRecord[];
  minStart: Date | null;
  maxEnd: Date | null;
} {
  const events: EventRecord[] = [];
  let minStart: number | null = null;
  let maxEnd: number | null = null;

  //map shiftId -> vehicleId so we can group all shifts into one tech row
  const shiftToVehicle = new Map<string, string>();
  for (const vehicle of modelInput.vehicles ?? []) {
    for (const shift of vehicle.shifts ?? []) {
      shiftToVehicle.set(shift.id, vehicle.id);
    }
  }

  for (const visit of modelInput.visits ?? []) {
    if (!visit.assignedVehicleShiftId || !visit.startTime || !visit.endTime) {
      //if visit is not scheduled we skip it for this view
      continue;
    }

    const start = new Date(visit.startTime);
    const end = new Date(visit.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const startMs = start.getTime();
    const endMs = end.getTime();
    if (minStart === null || startMs < minStart) minStart = startMs;
    if (maxEnd === null || endMs > maxEnd) maxEnd = endMs;

    const vehicleId =
      shiftToVehicle.get(visit.assignedVehicleShiftId) ??
      visit.assignedVehicleShiftId;

    events.push({
      id: visit.id,
      resourceId: vehicleId, //row = technician
      name: visit.name ?? visit.id,
      startDate: start,
      endDate: end,
    });
  }

  return {
    events,
    minStart: minStart !== null ? new Date(minStart) : null,
    maxEnd: maxEnd !== null ? new Date(maxEnd) : null,
  };
}

//shift view events: resourceId is the actual shiftId
function buildShiftEvents(modelInput: ModelInput): {
  events: EventRecord[];
  minStart: Date | null;
  maxEnd: Date | null;
} {
  const events: EventRecord[] = [];
  let minStart: number | null = null;
  let maxEnd: number | null = null;

  for (const visit of modelInput.visits ?? []) {
    if (!visit.assignedVehicleShiftId || !visit.startTime || !visit.endTime) {
      //unscheduled visits are ignored in the gantt timeline
      continue;
    }

    const start = new Date(visit.startTime);
    const end = new Date(visit.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const startMs = start.getTime();
    const endMs = end.getTime();
    if (minStart === null || startMs < minStart) minStart = startMs;
    if (maxEnd === null || endMs > maxEnd) maxEnd = endMs;

    events.push({
      id: visit.id,
      resourceId: visit.assignedVehicleShiftId, //row = shift
      name: visit.name ?? visit.id,
      startDate: start,
      endDate: end,
    });
  }

  return {
    events,
    minStart: minStart !== null ? new Date(minStart) : null,
    maxEnd: maxEnd !== null ? new Date(maxEnd) : null,
  };
}

//-----------------------------------------------------------------------------

interface SchedulerViewProps {
  routePlan: RoutePlanData | null;
  //allow parent to be notified when events are moved (drag and drop)
  onEventsChanged?: (updates: {
    id: string;
    resourceId: string;
    startDate: Date;
    endDate: Date;
  }[]) => void;
  //controls whether we show one row per technician or per-shift rows
  shiftViewMode?: 1 | 2 | 3 | 4;
}

export default function SchedulerView({
  routePlan,
  onEventsChanged,
  shiftViewMode = 1,
}: SchedulerViewProps) {
  //when true, each row = technician, otherwise row = individual shift
  const showPerTechnician = shiftViewMode === 1;

  //Compute bryntum resources/events only when plan or mode changes
  const { resources, events, startDate, endDate } = useMemo(() => {
    if (!routePlan) {
      const now = new Date();
      //fallback window for empty state so scheduler still mounts
      return {
        resources: [] as ResourceRecord[],
        events: [] as EventRecord[],
        startDate: now,
        endDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      };
    }

    const modelInput = routePlan.modelInput;

    const { events, minStart, maxEnd } = showPerTechnician
      ? buildTechEvents(modelInput)
      : buildShiftEvents(modelInput);

    const resources = showPerTechnician
      ? buildTechResources(modelInput)
      : buildShiftResources(modelInput);

    //time range is based on event span if possible, otherwise shift windows
    let s: Date;
    let e: Date;

    if (minStart && maxEnd) {
      const padMs = 30 * 60 * 1000;
      s = new Date(minStart.getTime() - padMs);
      e = new Date(maxEnd.getTime() + padMs);
    } else {
      const allShiftTimes = modelInput.vehicles
        .flatMap(v => v.shifts)
        .flatMap(sft => [sft.minStartTime, sft.maxEndTime])
        .filter(Boolean) as string[];

      const startDateStr = allShiftTimes[0] ?? new Date().toISOString();
      const endDateStr =
        allShiftTimes[allShiftTimes.length - 1] ?? new Date().toISOString();

      s = new Date(startDateStr);
      e = new Date(endDateStr);
    }

    //helps to avoid rerenderingtoo much when data shape has not changed
    return {
      resources,
      events,
      startDate: s,
      endDate: e,
    };
  }, [routePlan, showPerTechnician]);

  if (!routePlan) {
    //simple empty state if no data has been loaded yet
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        Load demo data to see the schedule.
      </div>
    );
  }

  //render bryntum scheduler with processed data
  return (
    <BryntumSchedulerPro
      barMargin={6}
      rowHeight={52}
      startDate={startDate}
      endDate={endDate}
      viewPreset="hourAndDay"
      resources={resources}
      events={events}
      eventStyle="colored"
      columns={[
        { type: 'resourceInfo', text: 'Technician', width: 220, showEventCount: false,   },
      ]}
      //stylish pill-shaped events with per-technician colors
      eventRenderer={({ eventRecord }: any) => {
        //look up the resource to get the technician (vehicle) id
        const resource = resources.find(r => r.id === eventRecord.resourceId);
        const colorKey = resource?.vehicleId ?? eventRecord.resourceId;

        const base = colorForResource(colorKey);
        const lighter = lighten(base, 0.25);

        return {
          children: eventRecord.name,
          style: `
            background-image: linear-gradient(135deg, ${lighter}, ${base});
            border-color: transparent;
            border-radius: 9999px;
            color: #f9fafb;
            font-size: 11px;
            font-weight: 500;
            padding: 0 8px;
            box-shadow: 0 1px 3px rgba(15,23,42,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          `,
        };
      }}
      //propagate drag-and-drop chages back to parent
      onEventDrop={(params: any) => {
        if (!onEventsChanged) return;

        //bryntum typically passes { eventRecords, ... } as the main payload
        const raw = params?.eventRecords ?? params?.events ?? [];
        const droppedEvents = Array.isArray(raw) ? raw : Array.from(raw ?? []);

        if (!droppedEvents.length) {
          return;
        }

        const updates = droppedEvents.map((e: any) => ({
          id: e.id,
          resourceId: e.resourceId,
          startDate: e.startDate,
          endDate: e.endDate,
        }));

        //let the parent page decide how to sync these udates back to modelInput
        onEventsChanged(updates);
      }}
    />
  );
}
