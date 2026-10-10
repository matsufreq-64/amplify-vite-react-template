import type { EventInput } from "./domain";
import type { fetchMapDetails } from "./api/location";
import { roundAltitude, roundCoordinate } from "./registrationDefaults";

type MapDetails = Awaited<ReturnType<typeof fetchMapDetails>>;

export function beginMapSelection(form: EventInput, latitude: number, longitude: number): EventInput {
  return {
    ...form,
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    altitude: undefined,
    localityJapaneseFull: "",
    localityJapaneseShort: "",
    localityRomaji: "",
    localityRomaji_1: "",
    localityRomaji_2: "",
    localityRomaji_3: "",
  };
}

export function applyMapDetails(form: EventInput, { altitude, place }: MapDetails): EventInput {
  return {
    ...form,
    ...(altitude.status === "fulfilled" ? { altitude: roundAltitude(altitude.value) } : {}),
    ...(place.status === "fulfilled" ? {
      localityJapaneseFull: place.value.placeName,
      localityJapaneseShort: place.value.shortPlaceName,
      localityRomaji_1: place.value.localityRomaji_1,
      localityRomaji_2: place.value.localityRomaji_2,
      localityRomaji_3: place.value.localityRomaji_3,
    } : {}),
  };
}
