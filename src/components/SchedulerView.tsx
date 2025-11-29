//src/components/SchedulerView.tsx
'use client';

import { useMemo } from 'react';
import type { RoutePlanData, ModelInput } from '@/types/timefold';
// use dynamic import so Bryntum only loads on the client
import dynamic from 'next/dynamic';

// dynamically import Bryntum so it only runs on client side, avoids ssr issues
const BryntumSchedulerPro = dynamic(
  () =>
    import('@bryntum/schedulerpro-react').then(
      (m) => m.BryntumSchedulerPro,
    ),
  { ssr: false },
);

// simple resource record used by Bryntum Scheduler
interface ResourceRecord {
  id: string;
  name: string;
  vehicleId: string;
}

// small event structure that maps visits to time slots
// NOTE: use Date objects so scheduler can work with them directly
interface EventRecord {
  id: string;
  resourceId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

// palette + helpers to give each technician (resource) a stable color
const palette = [
  '#16a34a', // green
  '#4f46e5', // indigo
  '#2563eb', // blue
  '#0d9488', // teal
  '#ea580c', // orange
  '#7c3aed', // purple
  '#db2777', // pink
  '#ca8a04', // amber
  '#dc2626', // red
  '#0891b2', // cyan
];

function colorIndexForResource(resourceId: string): number {
  let hash = 0;
  for (let i = 0; i < resourceId.length; i++) {
    hash = (hash * 31 + resourceId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % palette.length;
}

function colorForResource(resourceId: string): string {
  return palette[colorIndexForResource(resourceId)];
}

// simple lightening helper for gradients
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

function buildResources(modelInput: ModelInput): ResourceRecord[] {
  // creates a resource entry for each vehicle shift
  const resources: ResourceRecord[] = [];

  for (const vehicle of modelInput.vehicles ?? []) {
    for (const shift of vehicle.shifts ?? []) {
      resources.push({
        id: shift.id,
        name: vehicle.name ?? vehicle.id,
        vehicleId: vehicle.id,
      });
    }
  }
  return resources;
}

// Build events and also compute min/max time span
function buildEvents(modelInput: ModelInput): {
  events: EventRecord[];
  minStart: Date | null;
  maxEnd: Date | null;
} {
  // maps assigned visits into scheduler events
  const events: EventRecord[] = [];
  let minStart: number | null = null;
  let maxEnd: number | null = null;

  for (const visit of modelInput.visits ?? []) {
    if (!visit.assignedVehicleShiftId || !visit.startTime || !visit.endTime) {
      // unscheduled visit is skipped for optimized mode
      continue;
    }

    const start = new Date(visit.startTime);
    const end = new Date(visit.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      continue;
    }

    const startMs = start.getTime();
    const endMs = end.getTime();
    if (minStart === null || startMs < minStart) minStart = startMs;
    if (maxEnd === null || endMs > maxEnd) maxEnd = endMs;

    events.push({
      id: visit.id,
      resourceId: visit.assignedVehicleShiftId,
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

interface SchedulerViewProps {
  routePlan: RoutePlanData | null;
  // allow parent to be notified when events are moved (drag & drop)
  onEventsChanged?: (updates: {
    id: string;
    resourceId: string;
    startDate: Date;
    endDate: Date;
  }[]) => void;
}

export default function SchedulerView({
  routePlan,
  onEventsChanged,
}: SchedulerViewProps) {
  // Compute Bryntum resources/events only when plan changes
  const { resources, events, startDate, endDate } = useMemo(() => {
    if (!routePlan) {
      // fallback empty state for first load
      const now = new Date();
      return {
        resources: [] as ResourceRecord[],
        events: [] as EventRecord[],
        startDate: now,
        endDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      };
    }

    const resources = buildResources(routePlan.modelInput);
    const { events, minStart, maxEnd } = buildEvents(routePlan.modelInput);

    // Time range is based on event span if possible, otherwise shift windows
    let s: Date;
    let e: Date;

    if (minStart && maxEnd) {
      const padMs = 30 * 60 * 1000;
      s = new Date(minStart.getTime() - padMs);
      e = new Date(maxEnd.getTime() + padMs);
    } else {
      const allShiftTimes = routePlan.modelInput.vehicles
        .flatMap(v => v.shifts)
        .flatMap(s => [s.minStartTime, s.maxEndTime])
        .filter(Boolean) as string[];

      const startDateStr = allShiftTimes[0] ?? new Date().toISOString();
      const endDateStr =
        allShiftTimes[allShiftTimes.length - 1] ?? new Date().toISOString();

      s = new Date(startDateStr);
      e = new Date(endDateStr);
    }

    return {
      resources,
      events,
      startDate: s,
      endDate: e,
    };
  }, [routePlan]);

  if (!routePlan) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        Load demo data to see the schedule.
      </div>
    );
  }

  // Render Bryntum Scheduler with processed data
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
        { type: 'resourceInfo', text: 'Technician', width: 220 },
      ]}
      // Stylish pill-shaped events with per-technician colors
      eventRenderer={({ eventRecord }: any) => {
        const base = colorForResource(eventRecord.resourceId);
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
      // propagate drag-and-drop changes back to parent
      onEventDrop={({ events: droppedEvents }: any) => {
        if (!onEventsChanged) return;

        const updates = droppedEvents.map((e: any) => ({
          id: e.id,
          resourceId: e.resourceId,
          startDate: e.startDate,
          endDate: e.endDate,
        }));
        onEventsChanged(updates);
      }}
    />
  );
}
