import { defineBackend } from "@aws-amplify/backend";
import { aws_dynamodb as dynamodb, RemovalPolicy } from "aws-cdk-lib";
import { auth } from "./auth/resource";
import { data, createCollectionRecord } from "./data/resource";

const backend = defineBackend({
  auth,
  data,
  createCollectionRecord,
});

const counterStack = backend.createStack("CollectionRecordCounter");

const counterTable = new dynamodb.Table(
  counterStack,
  "CollectionRecordCounterTable",
  {
    partitionKey: {
      name: "id",
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.RETAIN,
  }
);

counterTable.grantReadWriteData(createRecordLambda);

backend.createCollectionRecord.addEnvironment(
  "COUNTER_TABLE_NAME",
  counterTable.tableName
);