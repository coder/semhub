import { getDomain, getSubdomain } from "tldts";

export function parseHostname(hostname: string) {
  // hostname does not include port
  // by default, tldts will not allow localhost, so we need to explicitly allow it
  const domain = getDomain(hostname, { validHosts: ["localhost"] });
  const subdomain = getSubdomain(hostname, { validHosts: ["localhost"] });
  return { domain, subdomain };
}
