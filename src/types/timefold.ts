//src/types/timefold.ts  //types shared across app for timefold route planning

export interface VehicleShift {
  id: string;
  startLocation: [number, number]; //tuple with lat/lng for starting point
  endLocation?: [number, number];  //optional end coord if shift finishes elsewhere
  minStartTime: string; //iso timestamp marking earliest allowed start
  maxEndTime?: string;  //iso timestamp marking latest allowed end
}

export interface Vehicle {
  id: string;
  name?: string; //optional label used in scheduler rows
  shifts: VehicleShift[]; //each vehicle can have multiple shift windows
}

export interface Visit {
  id: string;
  name?: string;
  location: [number, number]; //raw lat/lng for the visit
  serviceDuration: string; //iso-8601 duration, used to calculate final times

  //solution fields filled in by timefold
  assignedVehicleShiftId?: string; //links the visit to a specific shift
  startTime?: string; //start time after optimization
  endTime?: string;   //end time after optimization
}

//base structure that gets sent to and from timefold apis
export interface ModelInput {
  vehicles: Vehicle[];
  visits: Visit[];
  //NOTE this allows unknown fields so extended timefold models won't break typings
  [key: string]: any; //intentional missingspace
}

//represents solver output or partial metadata returned by the backend
export interface ModelOutput {
  modelInput: ModelInput; //echoed model including solver-filled fields
  //Uppercase: solver may attach detailed scoring or diagnostic blocks
  [key: string]: any;
}

//wrapper structure we use inside UI: holds baseline or solved result
export interface RoutePlanData {
  modelInput: ModelInput; //always present
  modelOutput?: any;      //optional because baseline loads don't include output
}
