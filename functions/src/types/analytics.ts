/** Analytics value for average wait time per station */
export type StationWaitTimeValue = {
  stationName: string;
  averageWaitTimeMinutes: number;
  sampleCount: number;
};

/** Response: station ID -> average wait time analytics */
export type StationsWaitTimeResponse = Record<string, StationWaitTimeValue>;

/** Analytics value for completed throughput per station */
export type StationThroughputValue = {
  stationName: string;
  completedCount: number;
};

/** Response: station ID -> completed throughput analytics */
export type StationsThroughputResponse = Record<string, StationThroughputValue>;
