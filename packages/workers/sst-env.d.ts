/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
import "sst"
export {}
import "sst"
declare module "sst" {
  export interface Resource {
    "GITHUB_APP_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "GITHUB_APP_INSTALLATION_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "GITHUB_APP_PRIVATE_KEY": {
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
    "Web": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
// cloudflare 
import * as cloudflare from "@cloudflare/workers-types";
declare module "sst" {
  export interface Resource {
    "Hono": cloudflare.Service
    "SyncRepoHandler": cloudflare.Service
  }
}
