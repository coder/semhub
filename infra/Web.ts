import { apiUrl } from "./Api";

const web = new sst.aws.StaticSite("Web", {
  path: "packages/web",
  environment: {
    VITE_API_URL: apiUrl.apply((url) => {
      if (typeof url !== "string") {
        throw new Error("API URL must be a string");
      }
      return url;
    }),
  },
  build: {
    command: "vite build",
    output: "./dist",
  },
});
// not officially launched yet, to switch over when it is?
// const web = new sst.cloudflare.StaticSite("Web", {
//   // TODO: domain and DNS stuf
//   path: "packages/web",
//   environment: {},
//   build: {
//     command: "vite build",
//     output: "./dist",
//   },
// });

export const outputs = {
  web: web.url,
};
