export const domain =
  {
    prod: "semhub.dev",
    stg: "stg.semhub.dev",
  }[$app.stage] || $app.stage + ".stg.semhub.dev";

export const zone = cloudflare.getZoneOutput({
  name: "semhub.dev",
});

export const outputs = {
  domain,
  zone,
};
