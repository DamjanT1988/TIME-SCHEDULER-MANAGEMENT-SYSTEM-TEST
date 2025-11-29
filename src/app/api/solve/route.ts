//app/api/solve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RoutePlanData } from '@/types/timefold';

const BASE_URL = process.env.TIMEFOLD_BASE_URL!;
const API_KEY = process.env.TIMEFOLD_API_KEY!;
const CONFIG_ID = process.env.TIMEFOLD_CONFIG_ID!;

//small helper to pause between polling attempts
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

    // First: send route plan request to timefold for solving
    const postRes = await fetch(`${BASE_URL}/route-plans`, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          run: { name: 'Caire demo route plan' },
          configurationId: CONFIG_ID,
        },
        modelInput,
      }),
    });

    if (!postRes.ok) {
      //log raw error text to help debug solver failures
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

    // Start polling loop until timefold reports a completed status
    let attempts = 0;
    let finalPlan: any = null;
    const maxAttempts = 20;

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
      const status = meta.status ?? meta.state ?? meta.solverStatus;

      //Check completion states returned by timefold
      if (status === 'COMPLETED' || status === 'TERMINATED_EARLY') {
        // fetch full optimized route plan now
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

    if (!finalPlan) {
      return NextResponse.json(
        { error: 'Solver did not complete in time' },
        { status: 500 },
      );
    }

    // Timefold usually returns both modelInput + modelOutput here
    const routePlan: RoutePlanData = {
      modelInput: finalPlan.modelInput ?? modelInput, //normalize if backend wraps differently
      modelOutput: finalPlan.modelOutput ?? finalPlan, //fallback to entire obj for debugging
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
