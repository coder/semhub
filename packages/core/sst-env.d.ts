/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */
import "sst"
export {}
import "sst"
declare module "sst" {
  export interface Resource {
    "Auth": {
      "publicKey": string
      "type": "sst.cloudflare.Auth"
      "url": string
    }
    "DATABASE_URL": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "GITHUB_PERSONAL_ACCESS_TOKEN": {
      "type": "sst.sst.Secret"
      "value": string
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
    "AuthAuthenticator": cloudflare.Service
    "AuthKv": cloudflare.KVNamespace
    "Hono": cloudflare.Service
    "InitCronHandler": cloudflare.Service
    "SyncEmbeddingHandler": cloudflare.Service
    "SyncIssueHandler": cloudflare.Service
  }
}
