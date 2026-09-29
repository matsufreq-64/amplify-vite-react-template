export type CollectingEvent = {
  id: string;
  eventNumber: number;
  localityJapaneseFull: string;
  localityJapaneseShort: string;
  localityRomaji: string;
  localityRomaji_1?: string;
  localityRomaji_2?: string;
  localityRomaji_3?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  date: string;
  collector: string;
  method: string;
  memo: string;
};
export type EventInput = Omit<CollectingEvent, "id" | "eventNumber">;
export type Specimen = {
  id: string;
  specimenNumber: number;
  collectingEventId: string;
  sex: string;
  memo: string;
};
export type IdentificationInput = {
  japaneseName: string;
  scientificName: string;
  identifiedAt: string;
  identifiedBy: string;
  memo: string;
};
export type Identification = IdentificationInput & {
  id: string;
  specimenId: string;
  createdAt: string;
  sequence: number;
};
export type Taxon = {
  id: string;
  scientificName: string;
  japaneseName?: string;
  orderJapaneseName?: string;
  orderScientificName?: string;
  familyJapaneseName?: string;
  familyScientificName?: string;
  subfamilyJapaneseName?: string;
  subfamilyScientificName?: string;
  genusScientificName?: string;
  descriptionYear?: number;
  sortOrder?: number;
};
export type LabelBatch = {
  id: string;
  collectingEventId: string;
  eventNumber: number;
  firstNumber: number;
  count: number;
  snapshot: CollectingEvent;
  createdAt: string;
};
export type SpecimenDetail = {
  event: CollectingEvent;
  specimen: Specimen | null;
  history: Identification[];
  issued: boolean;
};
export const emptyIdentification: IdentificationInput = {
  japaneseName: "",
  scientificName: "",
  identifiedAt: "",
  identifiedBy: "",
  memo: "",
};
export function numberValue(value: string | number): number {
  if (!/^\d{1,8}$/.test(String(value)))
    throw new Error("番号は1〜99999999の整数で入力してください。");
  const n = Number(value);
  if (n < 1) throw new Error("番号は1以上で入力してください。");
  return n;
}
export function parseQr(text: string): {
  eventNumber: number;
  specimenNumber: number;
} {
  const value = text.trim();
  const legacy = /^CE:(\d{8});SP:(\d{8})$/.exec(value);
  if (legacy)
    return {
      eventNumber: numberValue(legacy[1]),
      specimenNumber: numberValue(legacy[2]),
    };
  if (!/^\d{16}$/.test(value) && !/^\d{14}$/.test(value))
    throw new Error(
      "対応するQRではありません。16桁・14桁の数字、または旧CE/SP形式を読み取ってください。",
    );
  return {
    eventNumber: numberValue(value.slice(0, -8)),
    specimenNumber: numberValue(value.slice(-8)),
  };
}
export function makeQr(eventNumber: number, specimenNumber: number) {
  return (
    String(numberValue(eventNumber)).padStart(8, "0") +
    String(numberValue(specimenNumber)).padStart(8, "0")
  );
}
export const specimenLabel = (n: number) => `SP ${String(n).padStart(8, "0")}`;
