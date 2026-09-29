import { emptyIdentification, type IdentificationInput } from "./domain";
export const DEFAULT_COLLECTOR = "S. Matsubara";
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
