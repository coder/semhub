/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */
import "sst"
export {}
declare module "sst" {
  export interface Resource {
    "Auth": {
      "publicKey": string
      "type": "sst.cloudflare.Auth"
      "url": string
    }
    "AuthAuthenticator": {
      "type": "sst.cloudflare.Worker"
      "url": string
    }
    "AuthKv": {
      "type": "sst.cloudflare.Kv"
    }
    "DATABASE_URL": {
      "type": "sst.sst.Secret"
      "value": string
    }
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
    "SEMHUB_GITHUB_APP_CLIENT_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SEMHUB_GITHUB_APP_CLIENT_SECRET": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SecretKey": {
      "type": "sst.sst.Linkable"
      "value": string
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
