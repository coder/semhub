# SemHub

## Development

To develop using this repo, make sure you have installed the following:

- [Bun](https://bun.sh/docs/installation)

### Monorepo

1. `core/`

   This is for any shared code.

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

The `infra/` directory allows you to logically split the infrastructure of your app into separate files. This can be helpful as your app grows.

### Environment variables

You need the following environment variables (see `.env.example`) and secrets (see `.secrets.example`):

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare [account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/). (may not be 100% necessary)
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token to deploy Cloudflare workers and manage DNS.

We currently also use AWS to deploy the frontend, but this is temporary and will be replaced by Cloudflare in the future.

### Secrets

Make a copy of `.secrets.example` and name it `.secrets` and a copy of `.env.example` and name it `.env` and fill in the values above. To load the secrets into SST, run `bun secret:load`.

### Mobile

To test on mobile, use Ngrok to create a tunnel to your local frontend:

```zsh
ngrok http 3001
```

### Auth and cookies on local development

For auth to work on local development, there is a bit of rigmarole because we are running the frontend locally but the API server is on a `.semhub.dev` domain. So in order to set cookies, you need to:

1. Edit your `/etc/hosts` file to add a new entry for `local.semhub.dev` that points to `127.0.0.1`
2. Install and set up mkcert:

   ```bash
   brew install mkcert
   mkcert -install
   ```

3. Generate the local certificates:

   ```bash
   mkcert local.semhub.dev
   ```

   This will create two files: `local.semhub.dev-key.pem` and `local.semhub.dev.pem`

If you look at `vite.config.ts`, you will see that we reference these certificates to provide HTTPS for local development.

### OAuth

We choose to use GitHub App (instead of OAuth App) because of [these reasons](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps) (more granular control, scale with number of users, etc.). For dev vs prod, we use separate GitHub Apps (the production one is sited within the `coder` organization).

To set up a GitHub App:

- [Register a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) (dev one can be within your personal account, the [prod one](https://github.com/organizations/coder/settings/apps/coder-semhub) is within the `coder` organization)
  - In terms of permissions:
    - Select the following read-only Repository permissions: Metadata (mandatory), Discussions, Issues, Pull Requests, Contents. (These should be tracked in code via `github-app.ts`.)
    - Select the following read-only User permissions: Emails (actually would've gotten the user's email from the login process)
    - Select the following read-only Organization permissions: Members (to enable SemHub to work for users in the same organization after it has been installed by an admin)
  - Leave unchecked the box that says "Request user authorization (OAuth) during installation". Our app handles user login + creation.
  - Select redirect on update and use the frontend `/repos` page as the Setup URL
    - Local dev: `https://local.semhub.dev:3001/repos`
    - Prod: `https://semhub.dev/repos`
  - Callback URL is: `https://auth.[stage].stg.semhub.dev/github-login/callback` (see `packages/workers/src/auth/auth.constant.ts`)
  - Webhook URL is: `https://api.[stage].stg.semhub.dev/api/webhook/github`. The webhook secret is automatically generated by SST and can be revealed by modifying `outputs` in`infra/Secret.ts`. Installation events are automatically sent to this webhook, no need to subscribe manually. See [here](https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation). Unlike callback URL, there can only be one webhook URL per app.
- Generate and save the private key. NB the default format downloaded from GitHub is PKCS#1, but Octokit uses PKCS#8. You can convert the key using OpenSSL: `openssl pkcs8 -topk8 -inform PEM -in private-key.pem -outform PEM -out private-key-pkcs8.pem -nocrypt`.
- Create a GitHub Client ID and Secret and load it into the `.secrets.dev` file
- Go to Optional features and uncheck "User-to-server token expiration"

Note that when you use a GitHub App on a personal account, the warning message on the authorization page is misleading. See [this thread](https://github.com/orgs/community/discussions/37117).

## Deployment

Right now, deployment is manual. Eventually, will set up GitHub Actions to automate this.

### Deploying to new environment

For a deploying a given change to a new environment:

1. Load secrets. From root folder, run `bun secret:load:<env>`.
1. Run `sst deploy --stage <env>` first to create state in SST. This will fail.
1. Deploy Cloudflare resources. From `/packages/wrangler`, run `bun run deploy:all:<env>`.
1. Run database migrations on prod. From `core` folder, run: `bun db:migrate:<env>`.
1. Deploy SST resources again. This time it should succeed.

Should probably set up a script to do this automatically as part of CI/CD.

## Todos

1. Deal with users who install our GitHub App without creating an account first.
1. Current codebase assumes private/public property of repo is static and membership in org is static. Need to account for change. (Currently, we query membership for when subscription is made. But we should either receive webhook or regularly query to ensure that users that have left org should not have access to private repos.)

## Known issues

1. When bulk inserting using Drizzle, make sure that the array in `values()` is not empty. Hence the various checks to either early return if the array is empty or making such insertions conditional. If we accidentally pass an empty array, an error will be thrown, disrupting the control flow. TODO: enforce this by using ESLint?
1. Need some way to deal with error logging. Logging for SST-deployed workers is off by default (can turn it on via console, but it'll be overridden at the next update). At scale, will need to set something up so we will be informed of unknown errors.
