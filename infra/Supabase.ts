import * as pulumi from "@pulumi/pulumi";

const supabaseOrgId = process.env.SUPABASE_ORG_ID;
if (!supabaseOrgId) {
  throw new Error("SUPABASE_ORG_ID is not set");
}
const supabasePassword = new random.RandomString("SupabasePassword", {
  special: false, // some special characters like `@` will break connection string
  length: 20,
});

// Create a new Supabase project
const db = new supabase.Project("semhub-db", {
  name: `semhub-db-${$app.stage}`,
  organizationId: supabaseOrgId,
  databasePassword: supabasePassword.result,
  region: "ap-southeast-1",
});

// Get the pooler URL and replace the password placeholder
const supabaseDbUrl = pulumi
  .all([db.id, db.databasePassword])
  .apply(async ([projectId, password]) => {
    const pooler = await supabase.getPooler({ projectRef: projectId });
    const poolerTransactionUrl = pooler.url["transaction"];
    if (!poolerTransactionUrl) {
      throw new Error("Failed to get pooler transaction URL");
    }
    return poolerTransactionUrl.replace("[YOUR-PASSWORD]", password);
  });

export const outputs = {
  dbUrn: db.urn,
};

export const database = new sst.Linkable("Supabase", {
  properties: {
    projectName: db.name,
    organizationId: db.organizationId,
    region: db.region,
    databasePassword: db.databasePassword,
    instanceSize: db.instanceSize,
    databaseUrl: supabaseDbUrl,
  },
});
