import {
  type ClientSchema,
  a,
  defineData,
  defineFunction,
} from "@aws-amplify/backend";
export const createCollectionRecord = defineFunction({
  name: "create-collection-record",
  resourceGroupName: "data",
  entry: "./create-collection-record/handler.ts",
  timeoutSeconds: 30,
});
// Preserve the existing physical model, IDs and event numbers during the additive migration.
const schema = a.schema({
  Todo: a
    .model({ content: a.string() })
    .authorization((allow) => [allow.publicApiKey()]),
  CollectionRecord: a
    .model({
      recordNumber: a.integer().required(),
      location: a.string().required(),
      locationLabel: a.string().required(),
      locationRomaji: a.string().required(),
      localityRomaji_1: a.string(),
      localityRomaji_2: a.string(),
      localityRomaji_3: a.string(),
      latitude: a.float(),
      longitude: a.float(),
      altitude: a.float(),
      date: a.date().required(),
      collector: a.string().required(),
      collectingMethod: a.string().required(),
      memo: a.string(),
      owner: a.string(),
    })
    .secondaryIndexes((index) => [index("recordNumber").name("byEventNumber")])
    .authorization((allow) => [allow.owner().to(["read"])]),
  Specimen: a
    .model({
      specimenNumber: a.integer().required(),
      collectingEventId: a.id().required(),
      sex: a.string(),
      memo: a.string(),
      owner: a.string(),
    })
    .secondaryIndexes((index) => [
      index("specimenNumber"),
      index("collectingEventId"),
    ])
    .authorization((allow) => [allow.owner().to(["read"])]),
  Identification: a
    .model({
      specimenId: a.id().required(),
      identifiedAt: a.date(),
      identifiedBy: a.string(),
      japaneseName: a.string(),
      scientificName: a.string(),
      memo: a.string(),
      sequence: a.integer().required(),
      owner: a.string(),
    })
    .secondaryIndexes((index) => [
      index("specimenId").sortKeys(["sequence"]).name("bySpecimenHistory"),
    ])
    .authorization((allow) => [allow.owner().to(["read"])]),
  LabelBatch: a
    .model({
      collectingEventId: a.id().required(),
      eventNumber: a.integer().required(),
      firstNumber: a.integer().required(),
      count: a.integer().required(),
      snapshot: a.json().required(),
      owner: a.string(),
    })
    .authorization((allow) => [allow.owner().to(["read"])]),
  Taxon: a
    .model({
      japaneseName: a.string(),
      scientificName: a.string().required(),
      orderJapaneseName: a.string(),
      orderScientificName: a.string(),
      familyJapaneseName: a.string(),
      familyScientificName: a.string(),
      subfamilyJapaneseName: a.string(),
      subfamilyScientificName: a.string(),
      genusScientificName: a.string(),
      descriptionYear: a.integer(),
      sortOrder: a.float(),
      owner: a.string(),
    })
    .authorization((allow) => [allow.owner().to(["read"])]),
  registerCollectionRecord: a
    .mutation()
    .arguments({
      location: a.string().required(),
      locationLabel: a.string().required(),
      locationRomaji: a.string().required(),
      localityRomaji_1: a.string(),
      localityRomaji_2: a.string(),
      localityRomaji_3: a.string(),
      latitude: a.float().required(),
      longitude: a.float().required(),
      altitude: a.float().required(),
      date: a.date().required(),
      collector: a.string().required(),
      collectingMethod: a.string().required(),
    })
    .returns(a.ref("CollectionRecord"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createCollectionRecord)),
  collectionWorkflow: a
    .mutation()
    .arguments({ action: a.string().required(), payload: a.json().required() })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createCollectionRecord)),
});
export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
