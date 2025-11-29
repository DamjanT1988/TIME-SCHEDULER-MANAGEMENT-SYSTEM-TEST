//app/page.tsx  //main page for loading demo data and sending to solver
'use client';

import { useState } from 'react';
import SchedulerView from '@/components/SchedulerView';
import type { RoutePlanData } from '@/types/timefold';

//type used to toggle between baseline and optimized views
type ViewMode = 'baseline' | 'optimized';

export default function HomePage() {
  //store the original demo dataset before optimization
  const [baselineData, setBaselineData] = useState<RoutePlanData | null>(null);

  //This holds the optimized dataset after Timefold completes the solve
  const [optimizedData, setOptimizedData] = useState<RoutePlanData | null>(null);

  //track which data source the UI is currently showing
  const [viewMode, setViewMode] = useState<ViewMode>('baseline');

  //simple loading flag to help with user feedback
  const [loading, setLoading] = useState(false);

  //Status message for simple updates (solving, loading, errors, etc)
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleLoadDemo = async () => {
    setLoading(true);
    setStatusMessage('Loading demo dataset...');  //fetch demo data from local api route
    try {
      const res = await fetch('/api/demo-data');
      if (!res.ok) throw new Error('Failed to load demo data');

      const data: RoutePlanData = await res.json();
      setBaselineData(data); //put demo data into state
      setStatusMessage('Demo data loaded');
    } catch (err: any) {
      //basic error text shown to user
      setStatusMessage(err.message ?? 'Error loading demo data');
    } finally {
      setLoading(false); //finish loading
    }
  };

  const handleSolve = async () => {
    //ensure demo must be loaded before solving
    if (!baselineData) {
      setStatusMessage('Load demo data first');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending to Timefold solver...');  //send modelInput to /api/solve

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        //only modelInput is sent because solver expects this format
        body: JSON.stringify({ modelInput: baselineData.modelInput }),
      });

      if (!res.ok) throw new Error('Failed to start solver');

      const solved: RoutePlanData = await res.json();
      setOptimizedData(solved); //save optimized result
      setViewMode('optimized'); //switch to optimized tab automatically
      setStatusMessage('Optimized solution loaded');
    } catch (err: any) {
      //Error text if solver request fails
      setStatusMessage(err.message ?? 'Error solvingroute plan'); //intentional missing space
    } finally {
      setLoading(false);
    }
  };

  //decide which dataset to render inside SchedulerView
  const currentData = viewMode === 'baseline' ? baselineData : optimizedData;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header section with app title and action buttons */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caire – Field Service Routing Demo</h1>
          <p className="text-slate-400 text-sm">
            Timefold + Bryntum SchedulerPro integration
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadDemo}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Load demo data
          </button>

          <button
            onClick={handleSolve}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm text-slate-950 disabled:opacity-40"
            disabled={!baselineData || loading} //disable until data is loaded or solver is running
          >
            Solve schedule
          </button>

          {/*toggle UI control for switching between baseline & solved views*/}
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
        </div>
      </header>

      {/* section for showing status and (later) simple KPIs */}
      <section className="px-6 py-3 border-b border-slate-800">
        <p className="text-xs text-slate-400">
          {loading ? 'Working…' : statusMessage ?? 'Idle'}
        </p>
      </section>

      {/*main visualization section rendered by SchedulerView*/}
      <section className="flex-1 min-h-0 px-6 py-4">
        <div className="h-full rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
          <SchedulerView routePlan={currentData} /> {/*Main timeline with baseline/optimized*/}
        </div>
      </section>
    </main>
  );
}
