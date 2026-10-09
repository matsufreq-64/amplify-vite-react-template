import type { ElevationResponse, HeartRailsResponse } from "../types";
import { localityLabels } from "../localityLabels";

// APIで標高を取得する
export async function fetchElevation(
  latitude: number,
  longitude: number,
): Promise<number> {
  const parameters = new URLSearchParams({
    lon: String(longitude),
    lat: String(latitude),
    outtype: "JSON",
  });

  const response = await fetch(
    "https://cyberjapandata2.gsi.go.jp" +
      "/general/dem/scripts/getelevation.php?" +
      parameters.toString(),
  );

  if (!response.ok) {
    throw new Error("標高を取得できませんでした。");
  }

  const data: ElevationResponse = await response.json();
  const elevation = Number(data.elevation);

  if (!Number.isFinite(elevation)) {
    throw new Error("この地点の標高データはありません。");
  }

  return elevation;
}

// APIで地名を取得する
export async function fetchHeartRailsPlace(
  latitude: number,
  longitude: number,
) {
  const parameters = new URLSearchParams({
    method: "searchByGeoLocation",
    x: String(longitude),
    y: String(latitude),
  });

  const response = await fetch(
    "https://geoapi.heartrails.com/api/json?" + parameters.toString(),
  );

  if (!response.ok) {
    throw new Error("地名を取得できませんでした。");
  }

  const data: HeartRailsResponse = await response.json();
  const nearestLocation = data.response?.location?.[0];

  if (nearestLocation === undefined) {
    throw new Error("この地点付近の地名が見つかりませんでした。");
  }

  return {
    ...localityLabels(nearestLocation),
    placeName:
      nearestLocation.prefecture + nearestLocation.city + nearestLocation.town,
    placeNameKana: nearestLocation.city_kana + nearestLocation.town_kana,
  };
}
