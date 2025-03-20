import { Resend } from "resend";

export function getEmailClient(apiKey: string) {
  return new Resend(apiKey);
}

export async function sendEmail(
  {
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  },
  client: Resend,
  envPrefix: string,
) {
  const { data, error } = await client.emails.send({
    from: `${envPrefix ? `${envPrefix} ` : ""}SemHub <notifications@mail.semhub.dev>`,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export type EmailClient = ReturnType<typeof getEmailClient>;
