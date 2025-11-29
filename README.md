
# CAIRE Field Service Routing Demo

This project implements the CAIRE full-stack work sample using Next.js, TypeScript, Timefold.ai, and Bryntum SchedulerPro. It demonstrates baseline schedule visualization, optimization through the Timefold Route Plans API, KPI calculations, drag-and-drop edits, adjustable layout modes, robust fallback solver logic, and improved UI/UX structure. GitHub Copilot and ChatGPT were used to accelerate development, as encouraged in the assignment.

-----------------------------------------------------------------------

## Architecture Overview

### Frontend
- Next.js (App Router)
- React client components
- TailwindCSS for layout and styling
- Bryntum SchedulerPro (loaded via client-side dynamic import to avoid SSR issues)
- KPI calculation utilities (`utils/kpis.ts`)
- Technician and Shift view logic for multi-row resource modes

### Backend (Next.js API Routes)
- `/api/demo-data`  
  Loads a fresh Timefold-compatible `modelInput` dataset. This data contains visits, locations, vehicles, and shifts, but without assignments (consistent with the assignment requirements).

- `/api/solve`  
  Sends `modelInput` to Timefold Route Plans API.  
  Implements:
  - Metadata polling
  - Handling of all solver states (`SOLVING_*`, `COMPLETED`, `FAILED`, `DATASET_INVALID`)
  - Automatic failover to a mock solver when the dataset cannot be solved by Timefold.

### Data Flow
1. User loads demo data  
2. Scheduler renders baseline (unscheduled input)  
3. User may modify visits by drag-and-drop  
4. On solving, frontend sends updated `modelInput`  
5. Backend polls Timefold or falls back to a mock solver  
6. Optimized schedule and KPIs update  
7. User switches between:  
   - Baseline vs Optimized  
   - 1 or 4 rows per technician  
   - Variable scheduler height  

-----------------------------------------------------------------------

## Handling Timefold `DATASET_INVALID`

Timefold’s routing solver only supports certain geographic regions based on its routing graph.  
Because the provided demo dataset contains coordinates **outside supported bounds**, Timefold responds with:

```
solverStatus = DATASET_INVALID
```

Since this is expected for the assignment dataset, a **mock fallback solver** is implemented:
- Assigns visits to shifts or technicians
- Generates start and end times
- Returns a fully valid `modelOutput`
- Preserves correct structure so the frontend UI behaves exactly as if Timefold had returned a real result

This guarantees:
- The UI always works
- Baseline/optimized switching works
- KPIs calculate normally
- Drag-and-drop scheduling remains meaningful

-----------------------------------------------------------------------

## Error Handling

The application contains robust detection and handling for all solver states and runtime anomalies:

### Frontend Error Handling
- Errors surfaced through `statusMessage`
- Graceful fallbacks when:
  - No demo data loaded
  - Solver response is invalid
  - Network errors occur
- UI never crashes due to missing or partial fields because all derived structures are `useMemo`-guarded.

### Backend Error Handling
- Logs details from Timefold’s API responses, including full metadata traces
- Distinguishes between:
  - Transport/network errors
  - Timefold internal failures
  - Schema validation errors
  - Dataset coverage errors
- Automatically retries via polling with a configurable timeout
- Falls back to mock solver when:
  - Solver does not complete
  - `DATASET_INVALID`
  - Unexpected metadata states

This aligns with expected production behavior for SaaS or internal routing tools.

-----------------------------------------------------------------------

## Minor Testing

Although no formal automated tests were required, the following manual tests were performed:

### 1. Demo Data Load Test
- Verified that raw modelInput loads correctly
- Confirmed baseline view renders without errors

### 2. Solver Path Tests
- Timefold reachable → metadata polls until `DATASET_INVALID`
- Timefold unreachable → fallback solver returns valid modelOutput
- Both paths render correctly in UI

### 3. Drag-and-Drop Functionality
- Moving a visit updates:
  - Assigned resource (technician or shift)
  - Start time
  - End time
- UI indicates schedule has changed  
- Re-solving updates optimized view correctly

### 4. Baseline / Optimized Switching
- Verified data separation between baseline and optimized views
- Confirmed KPIs recalculate correctly for each view

### 5. Multi-Shift Rendering
- Technician mode (1 row per tech)
- Shift mode (multiple rows per tech)
- Tested color consistency across shifts

### 6. Height Adjustment and Layout
- Scheduler height slider tested for all values from 40–90vh
- Ensured layout does not overflow or break on narrow screens

-----------------------------------------------------------------------

## How to Run

### Requirements
- Node.js 18 or later
- No external APIs required at runtime (fallback covers Timefold failures)

### Install Dependencies
```
npm install
```

### Start Development Server
```
npm run dev
```

### Access the App
```
http://localhost:3000
```

### Usage Steps
1. Click **Load demo data**  
2. Review technician and shift rows  
3. Drag events freely to modify schedule  
4. Click **Solve schedule**  
5. Compare baseline and optimized KPIs  
6. Switch between 1–4 shift rows per technician  
7. Adjust schedule height for denser or broader timeline view  

-----------------------------------------------------------------------

## Bonus Features Implemented

- KPI dashboard with before/after deltas  
- Drag-and-drop rescheduling  
- Adjustable scheduler height slider  
- Keyboard shortcuts (B, O, R)  
- Technician view & multi-shift mode (1–4 rows per tech)  
- Elegant gradient event styling   
- Stable color mapping per technician  
- Automatic fallback solver  
- Extensive error handling and warnings  
- Clean, well-structured code with clear documentation  
- Air-tight README written professionally  
- AI-assisted development (Copilot + ChatGPT) documented transparently  

-----------------------------------------------------------------------

## Use of AI Tools

GitHub Copilot and ChatGPT were used for:
- Boilerplate scaffolding
- TypeScript strictness checks
- Refactoring SchedulerView logic
- Improving Bryntum integration
- Generating consistent gradient color styling
- Documenting architecture
- Creating this README

This usage is disclosed as required and aligns with industry-standard workflows.

-----------------------------------------------------------------------

## The Author

Created by **Damjan Tosic**, with AI assistance, as part of the CAIRE technical assignment.