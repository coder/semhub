export async function createHmacDigest({
  secretKey,
  data,
}: {
  secretKey: string;
  data: string;
}) {
  const encoder = new TextEncoder();

  const secretKeyData = encoder.encode(secretKey);

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
  secretKey,
  data,
  digest,
}: {
  secretKey: string;
  data: string;
  digest: string;
}) {
  const computedDigest = await createHmacDigest({ secretKey, data });
  return computedDigest === digest;
}
