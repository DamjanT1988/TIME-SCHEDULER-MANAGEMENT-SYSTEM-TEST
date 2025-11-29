# CAIRE Field Service Routing Demo

This project implements the CAIRE full-stack work sample using Next.js, TypeScript, Timefold.ai, Bryntum SchedulerPro, and React Leaflet. It demonstrates baseline schedule visualization, optimization through the Timefold Route Plans API, KPI calculations, drag-and-drop edits, adjustable layout modes, fallback solver logic, and a geographic map layer showing all visits colored per technician. GitHub Copilot and ChatGPT were used to accelerate development, as encouraged in the assignment.

-----------------------------------------------------------------------

## Architecture Overview

### Frontend
- Next.js (App Router)
- React client components
- TailwindCSS for layout and styling
- Bryntum SchedulerPro for schedule visualization (client-side dynamic import)
- React Leaflet map integration for geographic visualization of visits
- KPI utilities (`utils/kpis.ts`)
- Technician and Shift view modes (1 or 4 rows per technician)

### Backend (Next.js API Routes)
- `/api/demo-data` – loads a fresh Timefold-compatible `modelInput` demo dataset
- `/api/solve` – sends data to Timefold Route Plans API, polls metadata, and handles all solver states including `DATASET_INVALID`
- Mock solver used when dataset cannot be solved by Timefold

### Data Flow
1. Load demo data  
2. Scheduler renders baseline (unscheduled input)  
3. User adjusts visits via drag-and-drop  
4. User clicks Solve → backend polls Timefold  
5. If Timefold rejects (`DATASET_INVALID`), mock solver runs  
6. Optimized result displayed alongside KPIs  
7. User toggles between:
   - Baseline vs Optimized  
   - 1–4 shift rows  
   - Adjustable scheduler height  
   - Map view  
-----------------------------------------------------------------------

## React Leaflet Map

A lightweight map implementation shows all visits on a geographic map:
- One marker per visit  
- Marker color matches technician color from the Scheduler  
- Uses `DynamicMapInner` with `ssr:false` to avoid Leaflet SSR issues  
- Automatically updates when baseline / optimized data changes  
- Handles missing or invalid coordinates gracefully  
- Displays message: “No visits with valid coordinates to display”  

-----------------------------------------------------------------------

## Handling Timefold `DATASET_INVALID`

Timefold's routing solver validates input coordinates against its internal map graph.  
The assignment dataset contains coordinates *outside supported coverage*, so Timefold returns:

```
solverStatus = DATASET_INVALID
```

Because this is expected, a **mock solver** is implemented:
- Assigns visits to shifts  
- Generates start and end times  
- Produces a valid `modelOutput` structure  
- Ensures the entire UI workflow remains functional  

This allows all assignment features to be demonstrated even when the real solver cannot compute a plan.

-----------------------------------------------------------------------

## Error Handling

### Frontend
- All solver and network issues displayed through `statusMessage`
- Robust guarding around all derived structures to prevent undefined access
- Graceful fallback when:
  - No data loaded  
  - Invalid solver response  
  - Network failure  
  - Invalid coordinates  

### Backend
- Distinguishes between:
  - Transport/network errors  
  - Timefold validation errors  
  - Metadata polling timeouts  
  - Internal solver states  
- Automatically falls back to mock solver to maintain UX continuity  

-----------------------------------------------------------------------

## Minor Testing

### Functional Tests
- Demo dataset loads correctly  
- Baseline and optimized switching validated  
- Drag-and-drop editing updates visit assignments  
- KPI deltas recalculated correctly  
- Multi-row (shift) view tested  
- Height slider validates layout in various screen sizes  
- Map tested with valid/invalid coordinates  

### Degradation Tests
- Timefold unreachable → mock solver works  
- Dataset invalid → mock solver works  
- UI remains stable with missing fields  

-----------------------------------------------------------------------

## How to Run

### Requirements
- Node.js 18+  
- No external services required at runtime (mock solver ensures stability)

### Install
```
npm install
```

### Run
```
npm run dev
```

### Open in browser
```
http://localhost:3000
```

-----------------------------------------------------------------------

## Bonus Features Implemented

- KPI dashboard with delta comparison  
- Drag-and-drop rescheduling  
- Adjustable height slider  
- Keyboard shortcuts (B, O, R)  
- Technician and Shift view modes  
- Styled pill-shaped gradient events  
- Stable per-technician color mapping  
- Full React Leaflet map of all visits  
- Automatic fallback solver  
- Strong error handling  
- Polished README  
- AI-assisted development  

-----------------------------------------------------------------------

## Use of AI Tools

GitHub Copilot and ChatGPT were used for:
- Boilerplate
- TypeScript corrections
- Bryntum Scheduler integrations
- Leaflet SSR-safe setup
- Fallback solver logic
- README writing

Usage is disclosed as required by the assignment.

-----------------------------------------------------------------------

## Author

Created by **Damjan Tosic**, with AI assistance, as part of the CAIRE technical assignment.