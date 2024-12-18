import { getDomain, getSubdomain } from "tldts";

export function parseHostname(hostname: string) {
  // hostname does not include port
  const domain = getDomain(hostname, { validHosts: ["localhost"] });
  const subdomain = getSubdomain(hostname, { validHosts: ["localhost"] });
  return { domain, subdomain };
}
