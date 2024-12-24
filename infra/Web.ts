import { apiUrl } from "./Api";
import { domain } from "./Dns";
import { secret } from "./Secret";

const web = new sst.aws.StaticSite("Web", {
  path: "packages/web",
  environment: {
    // when adding new env vars, you may have to rm -rf node_modules
    VITE_API_URL: apiUrl.apply((url) => {
      if (typeof url !== "string") {
        throw new Error("API URL must be a string");
      }
      return url;
    }),
    // this is not a secret
    VITE_GITHUB_APP_NAME: secret.githubAppName.value,
  },
  build: {
    command: "vite build",
    output: "./dist",
  },
  domain: {
    // have to add CNAME record on Cloudflare to point to Cloudfront distribution manually?
    dns: false,
    name: domain,
    cert: "arn:aws:acm:us-east-1:522745012037:certificate/e21a712d-8ba1-418d-b04a-2504614ab453",
  },
  // domain: {
  //   name: domain,
  //   dns: sst.cloudflare.dns(),
  // },
});

// not officially launched and not really working, to switch over when it is?
// const web = new sst.cloudflare.StaticSite("Web", {
//  path: "packages/web",
//   environment: {
//     VITE_API_URL: apiUrl.apply((url) => {
//       if (typeof url !== "string") {
//         throw new Error("API URL must be a string");
//       }
//       return url;
//     }),
//   },
//   build: {
//     command: "vite build",
//     output: "./dist",
//   },
//   domain: {
//     name: domain,
//     dns: sst.cloudflare.dns(),
//   },
// });

export const outputs = {
  web: web.url,
};
