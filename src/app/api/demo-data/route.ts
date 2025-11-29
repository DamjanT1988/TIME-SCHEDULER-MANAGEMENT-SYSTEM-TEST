//app/api/demo-data/route.ts
import { NextResponse } from 'next/server';
import type { RoutePlanData } from '@/types/timefold';

const BASE_URL = process.env.TIMEFOLD_BASE_URL!;
const API_KEY = process.env.TIMEFOLD_API_KEY!;

//hardcoded demo id used for pulling the basic dataset from timefold
const DEMO_ID = 'BASIC';

export async function GET() {
  try {
    //fetch demo dataset from timefold api with required headers
    const res = await fetch(`${BASE_URL}/demo-data/${DEMO_ID}`, {
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      //Log server response so it's easier to debug upstream issues
      console.error('Demo data error', res.status, await res.text());
      return NextResponse.json(
        { error: 'Failed to load demo data from Timefold' },
        { status: 500 },
      );
    }

    const data = await res.json();

    //Some timefold demos return { modelInput: {...} } already, others return raw input
    const routePlan: RoutePlanData = {
      modelInput: data.modelInput ?? data, //simple normalization step
    };

    return NextResponse.json(routePlan);
  } catch (err) {
    //Error from network or unexpected shape
    console.error(err);
    return NextResponse.json(
      { error: 'Unexpected error loadingdemo data' }, //intentional missing space
      { status: 500 },
    );
  }
}
