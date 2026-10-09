import { emptyIdentification, type IdentificationInput } from "./domain";
export const DEFAULT_COLLECTOR = "S. Matsubara";
export const COLLECTOR_STORAGE_KEY = "collection-default-collector";
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
): IdentificationInput {
  return {
    ...emptyIdentification,
    japaneseName: carry ? (previous?.japaneseName ?? "") : "",
    scientificName: carry ? (previous?.scientificName ?? "") : "",
  };
}
