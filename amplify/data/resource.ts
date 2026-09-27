import { type ClientSchema, a, defineData, defineFunction } from "@aws-amplify/backend";

// 記録番号発番用
export const createCollectionRecord = defineFunction({
  name: "create-collection-record",
  entry: "./create-collection-record/handler.ts",
});

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

CollectionRecord: a
  .model({
    recordNumber: a.integer().required(),
    location: a.string().required(),
    locationLabel: a.string(),
    locationRomaji: a.string().required(),
    latitude: a.float().required(),
    longitude: a.float().required(),
    altitude: a.float().required(),
    date: a.date().required(),
    collector: a.string().required(),
    collectingMethod: a.string().required(),
    owner: a.string(),
  })
  .authorization((allow) => [allow.owner()]),

// データベースのテーブルの定義
// authorization allow.owner()のように、「誰がその記録を読み書きできるか」

  registerCollectionRecord: a
    .mutation()
    .arguments({
      location: a.string().required(),
      locationLabel: a.string(),
      locationRomaji: a.string().required(),
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

  })
  .authorization((allow) => [
  allow.resource(createCollectionRecord),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
