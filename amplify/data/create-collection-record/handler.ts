import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { env } from "$amplify/env/create-collection-record";
import type { Schema } from "../resource";

const { resourceConfig, libraryOptions } =
  await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const dynamodb = new DynamoDBClient({});

export const handler: Schema["registerCollectionRecord"]["functionHandler"] =
  async (event) => {
    const identity = event.identity as {
      sub?: string;
      username?: string;
    } | null;

    if (!identity?.sub || !identity.username) {
      throw new Error("ログイン情報を確認できませんでした。");
    }

    // 番号管理テーブルの1行を更新し、新しい番号を受け取る。
    const result = await dynamodb.send(
      new UpdateItemCommand({
        TableName: env.COUNTER_TABLE_NAME,
        Key: { id: { S: "collection-record" } },
        UpdateExpression:
          "SET #value = if_not_exists(#value, :initial) + :one",
        ConditionExpression:
          "attribute_not_exists(#value) OR #value < :maximum",
        ExpressionAttributeNames: {
          "#value": "value",
        },
        ExpressionAttributeValues: {
          ":initial": { N: "3" },
          ":one": { N: "1" },
          ":maximum": { N: "99999999" },
        },
        ReturnValues: "UPDATED_NEW",
      })
    );

    const recordNumber = Number(result.Attributes?.value?.N);
    if (!Number.isInteger(recordNumber)) {
      throw new Error("登録番号を取得できませんでした。");
    }

    const { data, errors } = await client.models.CollectionRecord.create(
      {
        ...event.arguments,
        recordNumber,
        owner: `${identity.sub}::${identity.username}`,
      },
      { authMode: "iam" }
    );

    if (errors?.length || !data) {
      throw new Error(
        errors?.map((error) => error.message).join("\n") ??
          "記録を保存できませんでした。"
      );
    }

    return data;
  };