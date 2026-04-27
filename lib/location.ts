export interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface LocationDetails {
  name: string;
  address: string;
  coordinates: string | null;
  isWithinAllowedArea: boolean;
  isNearestRegisteredLandmark?: boolean;
  nearestDistanceMeters?: number | null;
}

interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;
const NEAREST_LANDMARK_MAX_DISTANCE_METERS = 1000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistance(a: Coordinates, b: Coordinates) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);

  const c =
    sinDlat * sinDlat +
    Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;

  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return EARTH_RADIUS_METERS * d;
}

function parseCoordinates(locationString: string | null): Coordinates | null {
  if (!locationString) return null;
  if (locationString.startsWith("office:")) return null;

  const [latStr, lngStr] = locationString.split(',');
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function resolveLocationDetails(
  locationString: string | null,
  officeLocations: OfficeLocation[]
): LocationDetails {
  if (locationString?.startsWith("office:")) {
    const officeLocationId = locationString.slice("office:".length);
    const office = officeLocations.find((item) => item.id === officeLocationId);
    if (office) {
      return {
        name: `Biometric · ${office.name}`,
        address: office.address || "Biometric device punch tagged to this office location.",
        coordinates: null,
        isWithinAllowedArea: true,
      };
    }

    return {
      name: "Biometric office tag",
      address: "Biometric device punch imported with an office location tag.",
      coordinates: null,
      isWithinAllowedArea: true,
    };
  }

  const coords = parseCoordinates(locationString);
  if (!coords) {
    return {
      name: 'No GPS data',
      address: 'Location was not captured (e.g. punch from biometric device, admin clock, or location permission not granted).',
      coordinates: null,
      isWithinAllowedArea: false,
    };
  }

  if (!officeLocations.length) {
    const coordString = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    return {
      name: 'Waiting for location directory',
      address: coordString,
      coordinates: coordString,
      isWithinAllowedArea: false,
    };
  }

  const sorted = officeLocations
    .map((loc) => ({
      loc,
      distance: haversineDistance(coords, {
        lat: loc.latitude,
        lng: loc.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearest = sorted[0];
  const coordString = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  if (nearest && nearest.distance <= nearest.loc.radius_meters) {
    return {
      name: nearest.loc.name,
      address: nearest.loc.address || coordString,
      coordinates: coordString,
      isWithinAllowedArea: true,
      isNearestRegisteredLandmark: false,
      nearestDistanceMeters: nearest.distance,
    };
  }

  if (nearest && nearest.distance <= NEAREST_LANDMARK_MAX_DISTANCE_METERS) {
    return {
      name: `Near ${nearest.loc.name}`,
      address: nearest.loc.address || coordString,
      coordinates: coordString,
      isWithinAllowedArea: false,
      isNearestRegisteredLandmark: true,
      nearestDistanceMeters: nearest.distance,
    };
  }

  return {
    name: 'Pinned location',
    address: coordString,
    coordinates: coordString,
    isWithinAllowedArea: false,
    isNearestRegisteredLandmark: false,
    nearestDistanceMeters: nearest?.distance ?? null,
  };
}