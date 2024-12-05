# Semhub

## Development

To develop using this repo, make sure you have installed the following:

- [Bun](https://bun.sh/docs/installation)
- [SST](https://github.com/sst/ion)

You also need the following environment variables (see `.env.example`) and secrets (see `.secrets.example`):

Environment variables:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare [account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/).
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token to deploy Cloudflare workers and manage DNS.
- `SUPABASE_ACCESS_TOKEN`: We use Supabase as our database, you can generate this from the Supabase dashboard, under `Dashboard > Account > Access tokens > Generate new token`.
- `SUPABASE_ORG_ID`: Needed as part of IaC to create the Supabase project. You can find it in the URL of the Supabase dashboard when selecting your organization, i.e. `https://supabase.com/dashboard/org/{SUPABASE_ORG_ID}/general`

Secrets:

- `GITHUB_PERSONAL_ACCESS_TOKEN`
- `OPEN_API_KEY`

Make a copy of `.secrets.example` and name it `.secrets` and a copy of `.env.example` and name it `.env` and fill in the values above. To load the secrets into SST, run `bun secret:load`.

To test on mobile, use Ngrok to create a tunnel to your local server:

```zsh
ngrok http 3001
```

## Codebase

This template uses
[npm Workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces). It has 3
packages to start with and you can add more it.

1. `core/`

   This is for any shared code. It's defined as namespaces. For example, there's
   the `Example` namespace.

   ```ts
   export namespace Example {
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
   `sst shell` CLI.

### Infrastructure

The `infra/` directory allows you to logically split the infrastructure of your
app into separate files. This can be helpful as your app grows.

## Deployment

Right now, deployment is manual. Eventually, will set up GitHub Actions to automate this.

### Deploying to prod

- Deploy Cloudflare resources via `wrangler`. These are all defined in the `/packages/wrangler` folder.
  - We use Durable Objects as a rate limiter. At the time of writing, DO cannot be deployed via Pulumi/SST. `wrangler` also provides more configurability. Currently, we are using the same rate limiter for dev and prod, which is not ideal, but it also makes sense since I'm using the same API key (and OpenAI account) for both dev and prod.
  - We use Cloudflare Workflows to orchestrate the sync process.
  - To deploy Cloudflare resources to prod, run `bun run deploy:all:prod` from the `/packages/wrangler` folder.
- First, ensure SST secrets are loaded. From root folder, run `bun secret:load:prod`. Then, deploy SST resources by running `deploy:prod`.
- Run database migrations on prod. From `core` folder, run: `bun db:migrate:prod`.

## Misc dev notes

When bulk inserting using Drizzle, make sure that the array in `values()` is not empty. Hence the various checks to either early return if the array is empty or making such insertions conditional. If we accidentally pass an empty array, an error will be thrown, disrupting the control flow. TODO: enforce this by using ESLint?

## Known issues / todos

1. Set up proper OAuth to allow users to log in and authorise to load issues from private repos.
1. Need some way to deal with error logging. Logging for SST-deployed workers is off by default (can turn it on via console, but it'll be overridden at the next update). At scale, will need to set something up so we will be informed of unknown errors.
1. During I/O calls, might need to do more error handling. So far,
