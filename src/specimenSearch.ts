import type { CollectingEvent, Specimen } from "./domain";

export type SpecimenSearchCondition = {
  id: number;
  field: "locality" | "date" | "specimenNumber" | "eventNumber" | "memo";
  operator: "contains" | "equals" | "after" | "before";
  value: string;
};

const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();

export function matchesSpecimenConditions(
  specimen: Specimen,
  event: CollectingEvent | undefined,
  conditions: SpecimenSearchCondition[],
) {
  return conditions.every(({ field, operator, value }) => {
    const term = normalize(value);
    if (!term) return true;
    if (field === "date") {
      const date = event?.date ?? "";
      if (operator === "after") return date >= term;
      if (operator === "before") return !!date && date <= term;
      return date === term;
    }
    const candidates = field === "locality"
      ? [event?.localityJapaneseFull, event?.localityJapaneseShort, event?.localityRomaji,
        event?.localityRomaji_1, event?.localityRomaji_2, event?.localityRomaji_3]
      : field === "eventNumber"
        ? [String(event?.eventNumber ?? ""), event ? String(event.eventNumber).padStart(8, "0") : ""]
        : field === "specimenNumber"
          ? [String(specimen.specimenNumber), String(specimen.specimenNumber).padStart(8, "0")]
          : [specimen.memo];
    if ((field === "eventNumber" || field === "specimenNumber") && operator === "equals" && /^\d+$/.test(term))
      return (field === "eventNumber" ? event?.eventNumber : specimen.specimenNumber) === Number(term);
    return candidates.some((candidate) => operator === "equals"
      ? normalize(candidate ?? "") === term
      : normalize(candidate ?? "").includes(term));
  });
}

export function sortSpecimensNewest(
  specimens: Specimen[],
  events: Record<string, CollectingEvent>,
) {
  return [...specimens].sort((a, b) =>
    (events[b.collectingEventId]?.date ?? "").localeCompare(events[a.collectingEventId]?.date ?? "") ||
    b.specimenNumber - a.specimenNumber,
  );
}
