//app/page.tsx  //main page for loading demo data, solving schedules and showing kpis
'use client';

import { useState, useEffect } from 'react'; //bring in useEffect for keyboard shortcuts
import SchedulerView from '@/components/SchedulerView';
import type { RoutePlanData } from '@/types/timefold';
import { computeKpis } from '@/utils/kpis';
import type { KPIs } from '@/utils/kpis';

//type used to toggle between baseline and optimized views
type ViewMode = 'baseline' | 'optimized';

export default function HomePage() {
  //store the original demo dataset before optimization
  const [baselineData, setBaselineData] = useState<RoutePlanData | null>(null);

  //This holds the optimized dataset after the solve is completed
  const [optimizedData, setOptimizedData] = useState<RoutePlanData | null>(null);

  //track which dataset the user currently wants to see
  const [viewMode, setViewMode] = useState<ViewMode>('baseline');

  //simple loading flag to help with user feedback
  const [loading, setLoading] = useState(false);

  //message used to show loading state or errors
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  //make schedule height adjustable (in viewport height units)
  const [schedulerHeight, setSchedulerHeight] = useState<number>(70); //70vh default

  // NEW: controls whether scheduler shows one row per technician or per-shift rows
  const [shiftViewMode, setShiftViewMode] = useState<1 | 2 | 3 | 4>(1);

  const handleLoadDemo = async () => {
    setLoading(true);
    setStatusMessage('Loading demo dataset...');
    try {
      const res = await fetch('/api/demo-data');
      if (!res.ok) throw new Error('Failed to load demo data');

      const data: RoutePlanData = await res.json();
      console.log('Demo data from /api/demo-data:', JSON.stringify(data, null, 2));

      setBaselineData(data);
      setStatusMessage('Demo data loaded');
    } catch (err: any) {
      setStatusMessage(err.message ?? 'Error loading demo data');
    } finally {
      setLoading(false);
    }
  };

  const handleSolve = async () => {
    if (!baselineData) {
      setStatusMessage('Load demo data first');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending to Timefold solver...');

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelInput: baselineData.modelInput }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const msg =
          errJson?.error ??
          errJson?.message ??
          'Failed to start solver';
        throw new Error(msg);
      }

      const solved: RoutePlanData = await res.json();
      console.log('Optimized route plan:', JSON.stringify(solved, null, 2));

      setOptimizedData(solved);
      setViewMode('optimized');
      setStatusMessage('Optimized solution loaded');
    } catch (err: any) {
      setStatusMessage(err.message ?? 'Error solvingroute plan'); //intentional missing space
    } finally {
      setLoading(false);
    }
  };

  //helper to clear optimized output and go back to baseline
  const handleResetSolution = () => {
    setOptimizedData(null);
    setViewMode('baseline');
    setStatusMessage('Solution cleared. Showing baseline data.');
  };

  //handle drag-and-drop edits coming from SchedulerView
  const handleEventsChanged = (updates: {
    id: string;
    resourceId: string;
    startDate: Date;
    endDate: Date;
  }[]) => {
    let data = viewMode === 'baseline' ? baselineData : optimizedData;
    if (!data) return;

    const isTechView = shiftViewMode === 1;

    const updatedVisits = data.modelInput.visits.map(v => {
      const up = updates.find(u => u.id === v.id);
      if (!up) return v;

      // Decide which shiftId to assign based on current row mode
      let newShiftId = v.assignedVehicleShiftId ?? null;

      if (isTechView) {
        // row = technician (vehicle id); pick that vehicle's first shift as target
        const vehicle = data!.modelInput.vehicles.find(
          veh => veh.id === up.resourceId,
        );
        const targetShift = vehicle?.shifts?.[0];
        if (targetShift?.id) {
          newShiftId = targetShift.id;
        }
      } else {
        // row = shift id directly
        newShiftId = up.resourceId;
      }

      return {
        ...v,
        assignedVehicleShiftId: newShiftId ?? v.assignedVehicleShiftId,
        startTime: up.startDate.toISOString(),
        endTime: up.endDate.toISOString(),
      };
    });

    const newModelInput = {
      ...data.modelInput,
      visits: updatedVisits,
    };

    if (viewMode === 'baseline') {
      setBaselineData({ ...data, modelInput: newModelInput });
    } else {
      setOptimizedData({ ...data, modelInput: newModelInput });
    }

    setStatusMessage('Schedule updated. Press Solve to re-optimize.');
  };

  //keyboard shortcuts for switching views and quick solving
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        if (baselineData) {
          setViewMode('baseline');
          setStatusMessage('Switched to baseline view (keyboard).');
        }
      } else if (e.key === 'o' || e.key === 'O') {
        if (optimizedData) {
          setViewMode('optimized');
          setStatusMessage('Switched to optimized view (keyboard).');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (!loading && baselineData) {
          handleSolve();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [baselineData, optimizedData, loading]);

  //determine which dataset to feed into scheduler
  const currentData = viewMode === 'baseline' ? baselineData : optimizedData;

  //compute kpis based on current dataset
  const baselineKpis: KPIs | null = computeKpis(baselineData?.modelInput ?? null);
  const optimizedKpis: KPIs | null = computeKpis(optimizedData?.modelInput ?? null);
  const kpis: KPIs | null = viewMode === 'baseline' ? baselineKpis : optimizedKpis;

  //bonus: kpi deltas (how much better is optimized vs baseline)
  const showDeltas = Boolean(baselineKpis && optimizedKpis && viewMode === 'optimized');
  const scheduledDelta =
    showDeltas && baselineKpis && optimizedKpis
      ? optimizedKpis.scheduledVisitCount - baselineKpis.scheduledVisitCount
      : null;
  const avgPerVehicleDelta =
    showDeltas && baselineKpis && optimizedKpis
      ? optimizedKpis.avgVisitsPerVehicle - baselineKpis.avgVisitsPerVehicle
      : null;
  const totalHoursDelta =
    showDeltas && baselineKpis && optimizedKpis
      ? optimizedKpis.totalScheduledHours - baselineKpis.totalScheduledHours
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* header section with app title and action buttons */}
      <header className="border-b border-slate-800 px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caire – Field Service Routing Demo</h1>
          <p className="text-slate-400 text-sm">Timefold + Bryntum SchedulerPro integration</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadDemo}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Load demo data
          </button>

          <button
            onClick={handleSolve}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm text-slate-950 disabled:opacity-40"
            disabled={!baselineData || loading}
          >
            Solve schedule
          </button>

          {/* reset optimized result and go back to baseline */}
          <button
            onClick={handleResetSolution}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-100 disabled:opacity-40"
            disabled={!optimizedData && !baselineData}
          >
            Reset view
          </button>

          {/*toggle between baseline and optimized views*/}
          <div className="flex items-center gap-1 text-xs bg-slate-900 rounded-full px-1 py-1">
            <button
              className={`px-2 py-0.5 rounded-full ${
                viewMode === 'baseline' ? 'bg-slate-700' : ''
              }`}
              onClick={() => setViewMode('baseline')}
            >
              Baseline
            </button>
            <button
              className={`px-2 py-0.5 rounded-full ${
                viewMode === 'optimized' ? 'bg-slate-700' : ''
              }`}
              onClick={() => setViewMode('optimized')}
            >
              Optimized
            </button>
          </div>

          {/* NEW: row mode selector 1–4 */}
          <div className="flex items-center gap-1 text-xs bg-slate-900 rounded-full px-2 py-1">
            <span className="text-slate-400 mr-1">Shifts / tech</span>
            {[1, 4].map(n => (
              <button
                key={n}
                className={`px-1.5 py-0.5 rounded-full ${
                  shiftViewMode === n ? 'bg-slate-700 text-slate-50' : 'text-slate-400'
                }`}
                onClick={() => setShiftViewMode(n as 1 | 2 | 3 | 4)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* section for showing status and kpis */}
      <section className="px-6 py-3 border-b border-slate-800">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            {loading ? 'Working…' : statusMessage ?? 'Idle'}
          </p>

          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Vehicles" value={kpis.vehicleCount} />
              <KpiCard label="Visits" value={kpis.visitCount} />
              <KpiCard
                label="Scheduled"
                value={kpis.scheduledVisitCount}
                delta={scheduledDelta}
              />
              <KpiCard
                label="Avg / Vehicle"
                value={kpis.avgVisitsPerVehicle.toFixed(1)}
                delta={avgPerVehicleDelta}
              />
              <KpiCard
                label="Total Hours"
                value={kpis.totalScheduledHours.toFixed(1)}
                delta={totalHoursDelta}
              />
              <KpiCard
                label="Time Span"
                value={
                  kpis.scheduleStart && kpis.scheduleEnd
                    ? `${kpis.scheduleStart.slice(11, 16)} → ${kpis.scheduleEnd.slice(11, 16)}`
                    : '-'
                }
              />
            </div>
          )}

          {/* slider to adjust schedule height */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Schedule height</span>
            <input
              type="range"
              min={40}
              max={90}
              value={schedulerHeight}
              onChange={e => setSchedulerHeight(Number(e.target.value))}
              className="w-40"
            />
            <span></span>
          </div>

          {/* tiny helper line for keyboard shortcuts */}
          <p className="text-[10px] text-slate-500">
            Shortcuts: <span className="font-semibold text-slate-300">B</span> = Baseline,&nbsp;
            <span className="font-semibold text-slate-300">O</span> = Optimized,&nbsp;
            <span className="font-semibold text-slate-300">R</span> = Re-solve.
          </p>
        </div>
      </section>

      {/*main visualization section using bryntum scheduler*/}
      <section
        className="px-6 py-4"
        style={{ height: `${schedulerHeight}vh` }}
      >
        <div className="h-full rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
          <SchedulerView
            routePlan={currentData}
            onEventsChanged={handleEventsChanged}
            shiftViewMode={shiftViewMode}
          />
        </div>
      </section>
    </main>
  );
}

//kpi card component shown in top summary grid
function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
}) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta) && delta !== 0;
  let deltaText = '';
  if (hasDelta && typeof delta === 'number') {
    const abs = Math.abs(delta);
    const decimals = abs < 10 ? 1 : 0;
    deltaText = `${delta > 0 ? '+' : '-'}${abs.toFixed(decimals)}`;
  }

  const deltaClass =
    !hasDelta || typeof delta !== 'number'
      ? ''
      : delta < 0
      ? 'text-emerald-400'
      : 'text-rose-400';

  return (
    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-semibold text-lg mt-1">{value}</div>
      {hasDelta && (
        <div className={`mt-0.5 text-[10px] ${deltaClass}`}>
          {deltaText}
        </div>
      )}
    </div>
  );
}
