/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */

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
    "Keys": {
      "githubWebhookSecret": string
      "hmacSecretKey": string
      "type": "sst.sst.Linkable"
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
    "SEMHUB_GITHUB_APP_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SEMHUB_GITHUB_APP_PRIVATE_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SEMHUB_GITHUB_PUBLIC_LINK": {
      "type": "sst.sst.Secret"
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
    "SearchCacheKv": cloudflare.KVNamespace
    "SyncEmbeddingHandler": cloudflare.Service
    "SyncIssueHandler": cloudflare.Service
  }
}

import "sst"
export {}