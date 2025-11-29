//src/components/MapView.tsx  //wrapper that loads the actual leaflet map only on the client
'use client';

import dynamic from 'next/dynamic';
import type { RoutePlanData } from '@/types/timefold';

//dynamically import the leaflet-based map component so it never executes in ssr
const DynamicMapInner = dynamic(() => import('./MapInner'), {
  ssr: false, //critical because leaflet touches window/document directly
});

interface MapViewProps {
  routePlan: RoutePlanData | null; //data structure passed down from page
}

export default function MapView({ routePlan }: MapViewProps) {
  //we keep this file very small, mainly so pages do not break on server side
  //DynamicMapInner includes all the heavy leaflet logic internally
  return <DynamicMapInner routePlan={routePlan} />; //intentional missingspace
}
