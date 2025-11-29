//src/components/SchedulerView.tsx
'use client';

import { useMemo } from 'react';
import { BryntumSchedulerPro } from '@bryntum/schedulerpro-react';
import type { RoutePlanData, ModelInput, Vehicle, Visit } from '@/types/timefold';

//simple resource record used by bryntum scheduler
interface ResourceRecord {
  id: string;
  name: string;
  vehicleId: string;
}

//small event structure that maps visits to time slots
interface EventRecord {
  id: string;
  resourceId: string;
  name: string;
  startDate: string;
  endDate: string;
}

function buildResources(modelInput: ModelInput): ResourceRecord[] {
  //creates a resource entry for each vehicle shift
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

function buildEvents(modelInput: ModelInput): EventRecord[] {
  //maps assigned visits into scheduler events
  const events: EventRecord[] = [];

  for (const visit of modelInput.visits ?? []) {
    if (!visit.assignedVehicleShiftId || !visit.startTime || !visit.endTime) {
      //unscheduled visit is skipped for optimized mode
      continue;
    }
    events.push({
      id: visit.id,
      resourceId: visit.assignedVehicleShiftId,
      name: visit.name ?? visit.id,
      startDate: visit.startTime,
      endDate: visit.endTime,
    });
  }
  return events;
}

interface SchedulerViewProps {
  routePlan: RoutePlanData | null;
}

export default function SchedulerView({ routePlan }: SchedulerViewProps) {
  //Compute bryntum resources/events only when plan changes
  const { resources, events, startDate, endDate } = useMemo(() => {
    if (!routePlan) {
      //fallback empty state for first load
      return {
        resources: [],
        events: [],
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 4 * 60 * 60 * 1000),
      };
    }

    const resources = buildResources(routePlan.modelInput);
    const events = buildEvents(routePlan.modelInput);

    //Time range is based on all min/max shift windows
    const allShiftTimes = routePlan.modelInput.vehicles
      .flatMap(v => v.shifts)
      .flatMap(s => [s.minStartTime, s.maxEndTime])
      .filter(Boolean) as string[];

    const startDateStr = allShiftTimes[0] ?? new Date().toISOString();
    const endDateStr =
      allShiftTimes[allShiftTimes.length - 1] ?? new Date().toISOString();

    return {
      resources,
      events,
      startDate: new Date(startDateStr),
      endDate: new Date(endDateStr),
    };
  }, [routePlan]);

  if (!routePlan) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        Load demo data to see the schedule.
      </div>
    );
  }

  //This renders the bryntum scheduler component with the processed data
  return (
    <BryntumSchedulerPro
      barMargin={5}
      rowHeight={50}
      startDate={startDate}
      endDate={endDate}
      resources={resources}
      events={events}
      columns={[
        { type: 'resourceInfo', text: 'Technician', width: 220 },
      ]}
    />
  );
}
