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

const web = new sst.aws.StaticSite("Web", {
  path: "packages/web",
  environment: {},
  build: {
    command: "vite build",
    output: "./dist",
  },
});

export const outputs = {
  web: web.url,
};
