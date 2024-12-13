# Semhub

## Development

To develop using this repo, make sure you have installed the following:

- [Bun](https://bun.sh/docs/installation)
- [SST](https://github.com/sst/ion)

You also need the following environment variables (see `.env.example`) and secrets (see `.secrets.example`):

Environment variables:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare [account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/). (may not be 100% necessary)
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token to deploy Cloudflare workers and manage DNS.
- `SUPABASE_ACCESS_TOKEN`: We use Supabase as our database, you can generate this from the Supabase dashboard, under `Dashboard > Account > Access tokens > Generate new token`.
- `SUPABASE_ORG_ID`: Needed as part of IaC to create the Supabase project. You can find it in the URL of the Supabase dashboard when selecting your organization, i.e. `https://supabase.com/dashboard/org/{SUPABASE_ORG_ID}/general`

Secrets:

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

2. `workers/`

   This is for your Cloudflare Workers and it uses the `core` package as a local
   dependency.

3. `scripts/`

   This is for any scripts that you can run on your SST app using the
   `sst shell` CLI.

4. `wrangler/`

   This is for Cloudflare resources that are deployed via `wrangler`. We use this for Cloudflare resources that cannot be deployed via Pulumi/SST. `wrangler` also provides more configurability.

   - We use Durable Objects as a rate limiter. The rate limiter is currently unused, and the same durable object is used for dev and prod, which is not ideal, but it also makes sense since I'm using the same API key (and OpenAI account) for both dev and prod. To split in the future.
   - We use Cloudflare Workflows to orchestrate the sync process. See [the README](./packages/wrangler/README.md) for more details.

### Infrastructure

The `infra/` directory allows you to logically split the infrastructure of your
app into separate files. This can be helpful as your app grows.

## Deployment

Right now, deployment is manual. Eventually, will set up GitHub Actions to automate this.

### Deploying to prod

For a deploying a given change to prod, it makes sense (for backward compatibility) to run in the following order:

1. Run database migrations on prod. From `core` folder, run: `bun db:migrate:prod`.
1. Load secrets. From root folder, run `bun secret:load:prod`.
1. Deploy Cloudflare resources. From `/packages/wrangler`, run `bun run deploy:all:prod`.
1. Deploy SST resources. From root folder, run `deploy:prod`.

Should probably set up a script to do this automatically as part of CI/CD.

## Misc dev notes

When bulk inserting using Drizzle, make sure that the array in `values()` is not empty. Hence the various checks to either early return if the array is empty or making such insertions conditional. If we accidentally pass an empty array, an error will be thrown, disrupting the control flow. TODO: enforce this by using ESLint?

## Known issues / todos

1. Set up proper OAuth to allow users to log in and authorise to load issues from private repos.
1. Need some way to deal with error logging. Logging for SST-deployed workers is off by default (can turn it on via console, but it'll be overridden at the next update). At scale, will need to set something up so we will be informed of unknown errors.
