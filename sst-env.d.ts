/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
import "sst"
export {}
declare module "sst" {
  export interface Resource {
    "Hono": {
      "type": "sst.cloudflare.Worker"
      "url": string
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
