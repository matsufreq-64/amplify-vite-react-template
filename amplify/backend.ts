import { defineBackend } from "@aws-amplify/backend";
import {
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  RemovalPolicy,
} from "aws-cdk-lib";
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
  },
);

const createRecordLambda = backend.createCollectionRecord.resources.lambda;

counterTable.grantReadWriteData(createRecordLambda);

backend.createCollectionRecord.addEnvironment(
  "COUNTER_TABLE_NAME",
  counterTable.tableName,
);

for (const name of [
  "CollectionRecord",
  "Specimen",
  "Identification",
  "LabelBatch",
  "Taxon",
] as const) {
  const table = backend.data.resources.tables[name];
  table.grantReadWriteData(createRecordLambda);
  backend.createCollectionRecord.addEnvironment(
    `${name.toUpperCase()}_TABLE`,
    table.tableName,
  );
}

// Amplify exposes imported table constructs; grantReadWriteData can omit their
// secondary indexes. Query needs permission on the index ARN itself.
createRecordLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["dynamodb:Query"],
    resources: [
      `${backend.data.resources.tables.CollectionRecord.tableArn}/index/byEventNumber`,
      `${backend.data.resources.tables.Identification.tableArn}/index/bySpecimenHistory`,
    ],
  }),
);
