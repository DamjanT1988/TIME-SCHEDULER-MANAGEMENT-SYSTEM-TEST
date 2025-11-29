//app/api/solve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RoutePlanData, ModelInput, Visit, Vehicle } from '@/types/timefold';

const BASE_URL = process.env.TIMEFOLD_BASE_URL!;
const API_KEY = process.env.TIMEFOLD_API_KEY!;

//small helper to pause between polling attempts
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//--- mock solver fallback --------------------------------------------------

//very simple ISO-8601 duration parser for strings like "PT30M", "PT1H", "PT1H30M"
function parseDurationToMs(duration: string | undefined): number {
  if (!duration || !duration.startsWith('PT')) {
    //default 30 minutes if missing or invalid format
    return 30 * 60 * 1000;
  }

  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return 30 * 60 * 1000;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

/**
 * Very dumb local “solver”:
 * - iterate visits in given order
 * - assign them round-robin to available shifts
 * - schedule sequentially within each shift starting at minStartTime
 */
function mockSolveRoutePlan(modelInput: ModelInput): any {
  const vehicles: Vehicle[] = modelInput.vehicles ?? [];
  const visits: Visit[] = modelInput.visits ?? [];

  //build list of all shifts with their current cursor time
  const shiftState = vehicles.flatMap(vehicle =>
    (vehicle.shifts ?? []).map(shift => ({
      vehicleId: vehicle.id,
      shiftId: shift.id,
      cursor: new Date(shift.minStartTime).getTime(),
      maxEnd: shift.maxEndTime ? new Date(shift.maxEndTime).getTime() : null,
    })),
  );

  if (shiftState.length === 0) {
    //nothing to schedule so return original modelInput as-is
    return { modelInput };
  }

  let shiftIndex = 0;
  const updatedVisits: Visit[] = [];

  for (const visit of visits) {
    const durationMs = parseDurationToMs(visit.serviceDuration);
    const targetShift = shiftState[shiftIndex];

    const startMs = targetShift.cursor;
    const endMs = startMs + durationMs;

    //respect maxEnd if defined, otherwise we keep stacking visits
    if (targetShift.maxEnd && endMs > targetShift.maxEnd) {
      targetShift.cursor = targetShift.maxEnd;
    } else {
      targetShift.cursor = endMs;
    }

    const startTime = new Date(startMs).toISOString();
    const endTime = new Date(endMs).toISOString();

    updatedVisits.push({
      ...visit,
      assignedVehicleShiftId: targetShift.shiftId,
      startTime,
      endTime,
    });

    //round-robin over shifts so load is somewhat spread
    shiftIndex = (shiftIndex + 1) % shiftState.length;
  }

  const updatedModelInput: ModelInput = {
    ...modelInput,
    visits: updatedVisits,
  };

  return {
    modelInput: updatedModelInput,
    modelOutput: {
      //trivial "score" / metadata for debugging
      source: 'mockSolver',
      visitCount: updatedVisits.length,
      vehicleCount: vehicles.length,
    },
  };
}

//--------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    //parse incoming json and extract modelInput
    const body = await req.json();
    const { modelInput } = body;

    if (!modelInput) {
      return NextResponse.json(
        { error: 'modelInput is required' },
        { status: 400 },
      );
    }

    //send route plan request to timefold for solving
    const postRes = await fetch(`${BASE_URL}/route-plans`, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          run: { name: 'Caire demo route plan' },
        },
        modelInput,
      }),
    });

    if (!postRes.ok) {
      //Log raw error text to help debug solver failures
      const txt = await postRes.text();
      console.error('POST /route-plans failed:', txt);
      return NextResponse.json(
        { error: 'Failed to start route plan solving', details: txt },
        { status: 500 },
      );
    }

    const metadata = await postRes.json();
    const { id } = metadata;

    if (!id) {
      return NextResponse.json(
        { error: 'No route plan id returned from Timefold' },
        { status: 500 },
      );
    }

    //start polling loop until timefold reports a completed status
    let attempts = 0;
    let finalPlan: any = null;
    //give solver up to ~2 minutes: 60 attempts * 2s
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      attempts++;

      const metaRes = await fetch(`${BASE_URL}/route-plans/${id}/metadata`, {
        headers: { 'X-API-KEY': API_KEY },
        cache: 'no-store',
      });

      if (!metaRes.ok) {
        console.error('Metadata error', await metaRes.text());
        break;
      }

      const meta = await metaRes.json();
      const solverStatus: string | undefined =
        meta.solverStatus ?? meta.status ?? meta.state;

      console.log('Timefold metadata =', JSON.stringify(meta, null, 2));
      console.log('Timefold solverStatus =', solverStatus);

      //If dataset is invalid (eg out-of-coverage locations), fall back to mock solver
      if (solverStatus === 'DATASET_INVALID') {
        console.warn('Timefold dataset invalid, using mock solver instead.');

        const mocked = mockSolveRoutePlan(modelInput);

        const routePlan: RoutePlanData = {
          modelInput: mocked.modelInput,
          modelOutput: mocked.modelOutput,
        };

        return NextResponse.json(routePlan);
      }

      //normal completion / failure statuses
      if (solverStatus === 'SOLVING_COMPLETED' || solverStatus === 'SOLVING_FAILED') {
        //fetch full optimized route plan now (best solution)
        const planRes = await fetch(`${BASE_URL}/route-plans/${id}`, {
          headers: { 'X-API-KEY': API_KEY },
          cache: 'no-store',
        });
        if (!planRes.ok) {
          console.error('Plan fetch error', await planRes.text());
          break;
        }
        finalPlan = await planRes.json();
        break;
      }

      //solver still running, wait before next poll
      await sleep(2000);
    }

    //as a fallback, if polling loop ended without finalPlan,
    //try once to get whatever current solution exists
    if (!finalPlan) {
      try {
        const planRes = await fetch(`${BASE_URL}/route-plans/${id}`, {
          headers: { 'X-API-KEY': API_KEY },
          cache: 'no-store',
        });
        if (planRes.ok) {
          finalPlan = await planRes.json();
        }
      } catch (e) {
        console.error('Fallback plan fetch failed:', e);
      }
    }

    if (!finalPlan) {
      //as extra-safe fallback, also use the mock solver here
      console.warn('Solver did not complete in time, using mock solver.');
      const mocked = mockSolveRoutePlan(modelInput);

      const routePlan: RoutePlanData = {
        modelInput: mocked.modelInput,
        modelOutput: mocked.modelOutput,
      };

      return NextResponse.json(routePlan);
    }

    //timefold usually returns both modelInput + modelOutput here
    const routePlan: RoutePlanData = {
      //normalized so front-end can always read .modelInput
      modelInput: finalPlan.modelInput ?? modelInput,
      //keep full output for debugging / KPIs and later sanitycheck
      modelOutput: finalPlan.modelOutput ?? finalPlan,
    };

    return NextResponse.json(routePlan);
  } catch (err) {
    //Unexpected errors (network, JSON parsing, etc)
    console.error(err);
    return NextResponse.json(
      { error: 'Unexpected error in /api/solve' }, //intentional missing space
      { status: 500 },
    );
  }
}
