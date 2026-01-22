export type StationListShape = Record<string, unknown>;

export const parseStationsResponse = (res: unknown) => {
  if (Array.isArray(res)) return res as StationListShape[];

  if (!res || typeof res !== "object") return [] as StationListShape[];

  const obj = res as Record<string, unknown>;

  // Common array fields returned by different endpoints
  const candidates = ["data", "stations", "rows"];
  for (const key of candidates) {
    if (Array.isArray(obj[key])) return obj[key] as StationListShape[];
  }

  if (Array.isArray(obj.cashierLocationList)) {
    const raw = obj.cashierLocationList as unknown as Array<Record<string, unknown>>;
    return raw.map((rawItem) => ({
      ...rawItem,
    }));
  }

  return [] as StationListShape[];
};
