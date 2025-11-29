
# CAIRE Field Service Routing Demo

This project implements the CAIRE full-stack work sample using Next.js, TypeScript, Timefold.ai, and Bryntum SchedulerPro. It demonstrates baseline schedule visualization, optimization through the Timefold Route Plans API, KPI calculations, drag-and-drop edits, multiple layout modes, and robust fallback solver logic. GitHub Copilot and ChatGPT were used to accelerate development, as expected by the assignment.

-----------------------------------------------------------------------

## Architecture Overview

### Frontend
- Next.js (App Router)
- React (client components)
- TailwindCSS
- Bryntum SchedulerPro (client-only dynamic import)
- KPI calculation utilities
- Technician/Shift view logic

### Backend (within Next.js)
- `/api/demo-data` — Loads demo modelInput from official Timefold demo endpoints
- `/api/solve` — Sends modelInput to Timefold, polls solver status, handles all DONE/ERROR states
- Fallback mock solver for unsupported datasets

### Data Flow
1. Load baseline data  
2. Render in SchedulerPro (baseline mode)  
3. User may modify schedule via drag-and-drop  
4. User clicks Solve → `/api/solve`  
5. Optimized output is displayed with KPIs  
6. User can toggle:  
   - Baseline vs Optimized  
   - 1 or 4 rows per technician  
   - Schedule height  

-----------------------------------------------------------------------

## Handling Timefold `DATASET_INVALID`

Timefold’s routing solver validates all visit coordinates against an internal routing map.  
The demo dataset contains several locations outside allowed coverage. Because of this, the solver returns:

```
solverStatus = DATASET_INVALID
```

To maintain usability, a **mock fallback solver** is used:
- Fills assignments
- Generates start/end times
- Returns a valid modelOutput
- Preserves full UI interaction
- Allows baseline/optimized switching, KPIs, drag-drop, and re-solving

This fallback strictly mimics Timefold’s structure, ensuring the UI behaves as intended.

-----------------------------------------------------------------------

## How to Run

### Requirements
- Node.js 18+
- No external services required

### Install
```
npm install
```

### Run development server
```
npm run dev
```

### Access
```
http://localhost:3000
```

### Usage
1. Click **Load demo data**  
2. Explore the baseline schedule  
3. Optionally drag events to other technicians or times  
4. Click **Solve schedule**  
5. View optimized schedule and KPI deltas  
6. Toggle between 1–4 shift rows per technician  

-----------------------------------------------------------------------

## Bonus Features Implemented

- KPI dashboard with deltas  
- Drag-and-drop event handling  
- Height slider for scheduler  
- Keyboard shortcuts (B, O, R)  
- Technician and shift view modes (1–4 rows per technician)  
- Gradient-colored events based on technician  
- Fallback solver for invalid datasets  
- Clean architecture and clear comments  
- AI-assisted development (Copilot + ChatGPT)  
- Professional UI layout inspired by Bryntum and scheduling SaaS platforms  

-----------------------------------------------------------------------

## Use of AI Tools

GitHub Copilot and ChatGPT were used to:
- Speed up boilerplate
- Improve UI consistency
- Write data transformation logic
- Draft polling logic for Timefold
- Refactor SchedulerView to technician/shift modes
- Produce this README

This aligns with assignment expectations encouraging modern AI-assisted workflows.

-----------------------------------------------------------------------

## The author

This was created by Damjan Tosic with AI assistance