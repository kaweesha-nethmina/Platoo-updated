export const isValidLatitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -90 && value <= 90;

export const isValidLongitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -180 && value <= 180;

export const isValidCoordinatePair = (lat: number, lng: number): boolean =>
  isValidLatitude(lat) && isValidLongitude(lng);

export const isValidOrderId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 64 &&
  /^[a-zA-Z0-9_-]+$/.test(value);