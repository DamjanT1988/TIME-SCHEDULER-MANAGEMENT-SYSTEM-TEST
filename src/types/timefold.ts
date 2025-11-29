//src/types/timefold.ts  //types shared around the app for timefold data handling

export interface VehicleShift {
  id: string;
  startLocation: [number, number];
  endLocation?: [number, number];
  minStartTime: string; //iso timestamp used for earliest start
  maxEndTime?: string;  //iso end boundary for a shift
}

export interface Vehicle {
  id: string;
  name?: string;
  shifts: VehicleShift[]; //holds all shift windows for the vehicle
}

export interface Visit {
  id: string;
  name?: string;
  location: [number, number];
  serviceDuration: string; //duration in ISO format (PT1H etc)

  //In solution:
  assignedVehicleShiftId?: string; //id of the shift this visit gets attatched to
  startTime?: string;             //actual start time after solving
  endTime?: string;               //actual end time after solving
}

export interface ModelInput {
  vehicles: Vehicle[];
  visits: Visit[];
  //Capitalized: This is flexible so extra fields from Timefold models don't break the app
  [key: string]: any;
}

export interface ModelOutput {
  //represents the optimized output from the solver
  modelInput: ModelInput;
  //Capitalized: Metadata or scoring info may be included here later
  [key: string]: any;
}

//data structure we pass in UI components after solving
export interface RoutePlanData {
  modelInput: ModelInput;
  modelOutput?: any; //optional since baseline load doesn't include outputyet
}
