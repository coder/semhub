# Semhub

## Development

To develop using this repo, make sure you have installed the following:

- [Bun](https://bun.sh/docs/installation)
- [SST](https://github.com/sst/ion)

You also need the following environment variables (see `.env.example`) and secrets (see `.secrets.example`):

Environment variables:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token to deploy Cloudflare workers and manage DNS
- `SUPABASE_ACCESS_TOKEN`: we use Supabase as our database, you can get this from the Supabase dashboard
- `SUPABASE_ORG_ID`: needed as part of IaC to create the Supabase project

Secrets:

- `GITHUB_APP_ID`: GitHub App ID for the `coder/semhub` GitHub App
- `GITHUB_APP_PRIVATE_KEY`: GitHub App private key; to save this as a single string, you must (1) keep the header and footer `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` and (2) concatenate the lines and replace the newlines with `\n`
- `GITHUB_APP_INSTALLATION_ID`: GitHub App installation ID. You can install the app on your user or your organization. The installation ID is in the URL of the installation page (i.e. `https://github.com/settings/installations/{installation_id}`)

Make a copy of `.secrets.example` and name it `.secrets` and a copy of `.env.example` and name it `.env` and fill in the values above. To load the secrets into SST, run `bun secret:load`.

## Codebase

This template uses
[npm Workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces). It has 3
packages to start with and you can add more it.

1. `core/`

   This is for any shared code. It's defined as modules. For example, there's
   the `Example` module.

   ```ts
   export module Example {
     export function hello() {
       return "Hello, world!";
     }
   }
   ```

   That you can use across other packages using.

   ```ts
   import { Example } from "@aws-monorepo/core/example";

   Example.hello();
   ```

2. `functions/`

   This is for your Cloudflare Workers and it uses the `core` package as a local
   dependency.

3. `scripts/`

   This is for any scripts that you can run on your SST app using the
   `sst shell` CLI and [`tsx`](https://www.npmjs.com/package/tsx). For example,
   you can run the example script using:

   ```bash
   npm run shell src/example.ts
   ```

### Infrastructure

The `infra/` directory allows you to logically split the infrastructure of your
app into separate files. This can be helpful as your app grows.

In the template, we have an `api.ts`, and `storage.ts`. These export the created
resources. And are imported in the `sst.config.ts`.
