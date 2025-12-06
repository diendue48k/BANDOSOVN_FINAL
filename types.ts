
export type ViewMode = 'sites' | 'persons';

export interface Site {
  site_id: string | number;
  site_name: string;
  site_type: string;
  latitude: number;
  longitude: number;
  address?: string;
  established_year?: number;
  status?: string;
  description?: string;
  additional_info?: { [key: string]: string };
  city_id?: string | number; // Added for filtering
}

export interface Person {
  person_id: string | number;
  full_name: string;
  birth_year?: number;
  death_year?: number;
  related_city_ids?: (string | number)[];
  // New fields for map visualization based on birthplace
  latitude?: number;
  longitude?: number;
  location_name?: string;
}

export interface Media {
  media_id: string | number;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  thumbnail_url?: string;
}

export interface Event {
  event_id: string | number;
  event_name: string;
  start_date?: string;
  end_date?: string;
  description: string;
  persons?: Person[];
  media?: Media[];
  related_site_id?: string | number;
  related_site_name?: string;
}

export interface SiteDetail extends Site {
  events: Event[];
}

export interface PersonDetail extends Person {
    biography: string;
    media: Media[];
    events: Event[];
    additional_info?: { [key: string]: string };
}

// --- Directions Types ---
export interface RouteStep {
  instruction: string;
  distance: string;
}

export interface RouteSummary {
  totalDistance: string;
  totalDuration: string;
}

export interface RouteData {
  summary: RouteSummary;
  steps: RouteStep[];
  routeGeometry: [number, number][];
}

export interface AddressSearchResult {
  name: string;
  address: string;
  coordinates: [number, number];
}
