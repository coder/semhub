/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
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
    "OPENAI_API_KEY": {
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
    "SyncHandler": {
      "type": "sst.cloudflare.Worker"
    }
    "Web": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
