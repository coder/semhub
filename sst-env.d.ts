/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */
import "sst"
export {}
declare module "sst" {
  export interface Resource {
    "GITHUB_PERSONAL_ACCESS_TOKEN": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Hono": {
      "type": "sst.cloudflare.Worker"
      "url": string
    }
    "InitCronHandler": {
      "type": "sst.cloudflare.Worker"
    }
    "OPENAI_API_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "RESEND_API_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Supabase": {
      "databasePassword": string
      "databaseUrl": string
      "organizationId": string
      "projectName": string
      "region": string
      "type": "sst.sst.Linkable"
    }
    "SyncEmbeddingHandler": {
      "type": "sst.cloudflare.Worker"
    }
    "SyncIssueHandler": {
      "type": "sst.cloudflare.Worker"
    }
    "Web": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
