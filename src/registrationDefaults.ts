import { emptyIdentification, type IdentificationInput } from "./domain";
export const DEFAULT_COLLECTOR = "S. Matsubara";
export const COLLECTOR_STORAGE_KEY = "collection-default-collector";
export const IDENTIFIER_STORAGE_KEY = "collection-default-identifier";
export const USE_CURRENT_LOCATION_STORAGE_KEY =
  "collection-use-current-location";
export function getUseCurrentLocation(storage?: Pick<Storage, "getItem">) {
  try {
    storage ??= typeof window === "undefined" ? undefined : window.localStorage;
    return storage?.getItem(USE_CURRENT_LOCATION_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}
export function setUseCurrentLocation(
  enabled: boolean,
  storage?: Pick<Storage, "setItem">,
) {
  (storage ?? window.localStorage).setItem(
    USE_CURRENT_LOCATION_STORAGE_KEY,
    String(enabled),
  );
  return enabled;
}
export function getDefaultCollector(storage?: Pick<Storage, "getItem">) {
  try {
    storage ??= typeof window === "undefined" ? undefined : window.localStorage;
    return storage?.getItem(COLLECTOR_STORAGE_KEY)?.trim() || DEFAULT_COLLECTOR;
  } catch {
    return DEFAULT_COLLECTOR;
  }
}
export function setDefaultCollector(
  name: string,
  storage?: Pick<Storage, "setItem">,
) {
  const value = name.trim();
  if (!value) throw new Error("採集者名を入力してください。");
  (storage ?? window.localStorage).setItem(COLLECTOR_STORAGE_KEY, value);
  return value;
}
export function getDefaultIdentifier(storage?: Pick<Storage, "getItem">) {
  try {
    storage ??= typeof window === "undefined" ? undefined : window.localStorage;
    return (
      storage?.getItem(IDENTIFIER_STORAGE_KEY)?.trim() ||
      getDefaultCollector(storage)
    );
  } catch {
    return DEFAULT_COLLECTOR;
  }
}
export function setDefaultIdentifier(
  name: string,
  storage?: Pick<Storage, "setItem">,
) {
  const value = name.trim();
  if (!value) throw new Error("同定者名を入力してください。");
  (storage ?? window.localStorage).setItem(IDENTIFIER_STORAGE_KEY, value);
  return value;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function initialIdentification(
  date = new Date(),
  storage?: Pick<Storage, "getItem">,
): IdentificationInput {
  return {
    ...emptyIdentification,
    identifiedAt: localDate(date),
    identifiedBy: getDefaultIdentifier(storage),
  };
}
export function roundAltitude(value: number | undefined) {
  return value == null
    ? undefined
    : Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
export function roundCoordinate(value: number | undefined) {
  return value == null ? undefined : Number(value.toFixed(4));
}
export function nextIdentification(
  previous: IdentificationInput | null,
  carry: boolean,
  date = new Date(),
  storage?: Pick<Storage, "getItem">,
): IdentificationInput {
  return {
    ...initialIdentification(date, storage),
    japaneseName: carry ? (previous?.japaneseName ?? "") : "",
    scientificName: carry ? (previous?.scientificName ?? "") : "",
  };
}
