export type Position = {
  latitude: number;
  longitude: number;
};

export type ElevationResponse = {
  elevation: number | string;
  hsrc: string;
};

export type HeartRailsLocation = {
  prefecture: string;
  city: string;
  city_kana: string;
  town: string;
  town_kana: string;
  postal: string;
  x: string;
  y: string;
  distance: number;
};

export type HeartRailsResponse = {
  response?: {
    location?: HeartRailsLocation[];
    error?: string;
  };
};

export type MapClickHandlerProps = {
  onSelect: (
    latitude: number,
    longitude: number
  ) => void;
};

export type RecordCardProps = {
  record: CollectionRecord;
  onDelete: (cloudId: string) => void;
};

export type CollectionRecord = {
  id: number;
  cloudId: string;
  location: string;
  locationLabel: string;
  locationRomaji: string;
  latitude: number;
  longitude: number;
  altitude: number;
  date: string;
  collector: string;
  collectingMethod: string;
};
