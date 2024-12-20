export async function createHmacDigest({
  secret,
  data,
}: {
  secret: string;
  data: string;
}) {
  const encoder = new TextEncoder();

  const secretKeyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  const base64Mac = Buffer.from(mac).toString("base64");

  return base64Mac;
}

export async function verifyHmacDigest({
  secret,
  data,
  digest,
}: {
  secret: string;
  data: string;
  digest: string;
}) {
  const computedDigest = await createHmacDigest({ secret, data });
  return computedDigest === digest;
}
