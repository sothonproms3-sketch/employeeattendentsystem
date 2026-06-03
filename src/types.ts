export interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "check_in" | "check_out";
  latitude: number;
  longitude: number;
  distance: number;
  timestamp: string; // ISO true server timestamp
  photo: string; // Base64 Captured Camera image URL
  deviceName?: string;
}

export interface OfficeConfig {
  latitude: number;
  longitude: number;
  name: string;
  radius: number;
}

export interface GeolocationState {
  coords: {
    latitude: number;
    longitude: number;
  } | null;
  distance: number | null;
  status: "detecting" | "available" | "denied" | "unsupported";
  isWithinBounds: boolean;
  error?: string;
}

export interface CameraState {
  stream: MediaStream | null;
  status: "idle" | "requesting" | "ready" | "denied" | "unavailable";
  error?: string;
}
