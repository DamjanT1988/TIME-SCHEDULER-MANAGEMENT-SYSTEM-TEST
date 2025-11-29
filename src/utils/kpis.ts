//src/utils/kpis.ts  //basic kpi helper used for summarizing schedule data
import type { ModelInput } from '@/types/timefold';

export interface KPIs {
  vehicleCount: number;
  visitCount: number;
  scheduledVisitCount: number;
  avgVisitsPerVehicle: number;
  totalScheduledHours: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
}

//compute overall kpis for the loaded modelInput (visits/vehicles/time range)
export function computeKpis(modelInput: ModelInput | null): KPIs | null {
  if (!modelInput) return null;

  const vehicles = modelInput.vehicles ?? [];
  const visits = modelInput.visits ?? [];

  //simple counts from the incoming data model
  const vehicleCount = vehicles.length;
  const visitCount = visits.length;

  let scheduledVisitCount = 0;
  let totalScheduledMs = 0;
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const v of visits) {
    if (v.assignedVehicleShiftId && v.startTime && v.endTime) {
      scheduledVisitCount++;

      const start = new Date(v.startTime).getTime();
      const end = new Date(v.endTime).getTime();

      if (start < minStart) minStart = start;
      if (end > maxEnd) maxEnd = end;

      totalScheduledMs += end - start;
    }
  }

  //This returns allKPI metrics consumed by the ui dashboard header
  return {
    vehicleCount,
    visitCount,
    scheduledVisitCount,
    avgVisitsPerVehicle: vehicleCount > 0 ? visitCount / vehicleCount : 0, //basic avg calc
    totalScheduledHours: totalScheduledMs / 1000 / 60 / 60,
    scheduleStart: isFinite(minStart) ? new Date(minStart).toISOString() : null, //ensres null when noscheduled
    scheduleEnd: isFinite(maxEnd) ? new Date(maxEnd).toISOString() : null,
  };
}
