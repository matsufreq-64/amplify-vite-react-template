import { generateClient } from "aws-amplify/data";
import { isUiTestMode } from "../testMode";
import type { Schema } from "../../amplify/data/resource";
import type {
  CollectingEvent,
  EventInput,
  Identification,
  IdentificationInput,
  LabelBatch,
  Specimen,
  SpecimenDetail,
  Taxon,
} from "../domain";
const client = generateClient<Schema>();
const pending = new Map<string, string>();
async function call<T>(
  action: string,
  payload: object,
  write = false,
): Promise<T> {
  if (isUiTestMode)
    throw new Error(
      "画面テストモードではAWSの保存・読込はできません。データを使うテストは通常起動（npm run dev）でサインインしてください。",
    );
  if (typeof client.mutations.collectionWorkflow !== "function")
    throw new Error(
      "バックエンドの更新が必要です。新しいAmplify定義をデプロイし、amplify_outputs.jsonを更新してください。",
    );
  const key = JSON.stringify({ action, payload });
  // Keep the same ID after an uncertain network failure, including a page reload.
  let requestId = pending.get(key);
  if (write && !requestId) {
    try {
      requestId = sessionStorage.getItem(key) || undefined;
    } catch {
      /* private browsing */
    }
    requestId ??= crypto.randomUUID();
    pending.set(key, requestId);
    try {
      sessionStorage.setItem(key, requestId);
    } catch {
      /* in-memory retry still works */
    }
  }
  const result = await client.mutations.collectionWorkflow(
    {
      action,
      payload: JSON.stringify(write ? { ...payload, requestId } : payload),
    },
    { authMode: "userPool" },
  );
  if (result.errors?.length)
    throw new Error(result.errors.map((e) => e.message).join("\n"));
  if (result.data == null)
    throw new Error(
      "応答を確認できませんでした。同じ内容で再試行してください。",
    );
  if (write) {
    pending.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* optional storage */
    }
  }
  return (
    typeof result.data === "string" ? JSON.parse(result.data) : result.data
  ) as T;
}
export type Page<T> = { items: T[]; cursor: string | null };
export const listPage = <T>(model: string, cursor?: string | null) =>
  call<Page<T>>("list", { model, cursor });
export const findEvent = (eventNumber: number) =>
  call<CollectingEvent>("findEvent", { eventNumber });
export const createEvent = (input: EventInput) =>
  call<CollectingEvent>("createEvent", input, true);
export const reserveLabels = (eventNumber: number, count: number) =>
  call<LabelBatch>("reserveLabels", { eventNumber, count }, true);
export const lookupSpecimen = (specimenNumber: number, eventNumber?: number) =>
  call<SpecimenDetail>("lookupSpecimen", { specimenNumber, eventNumber });
export const registerSpecimen = (input: {
  eventNumber: number;
  specimenNumber: number;
  sex: string;
  memo: string;
  identification: IdentificationInput;
}) => call<Specimen>("registerSpecimen", input, true);
export const addIdentification = (
  specimenId: string,
  input: IdentificationInput,
) => call<Identification>("addIdentification", { specimenId, ...input }, true);
export const saveTaxon = (input: Omit<Taxon, "id"> & { id?: string }) =>
  call<Taxon>("saveTaxon", input, true);
export async function searchTaxa(query: string) {
  const results: Taxon[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await listPage<Taxon>("Taxon", cursor);
    results.push(
      ...page.items.filter((t) =>
        `${t.japaneseName} ${t.scientificName}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    );
    cursor = page.cursor;
  } while (cursor && results.length < 20);
  return results
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 20);
}
