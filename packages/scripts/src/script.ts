import { sendEmail } from "@/core/email";
import { getDeps } from "@/deps";

const { emailClient } = getDeps();

await sendEmail(
  {
    to: "warren@coder.com",
    subject: "Test",
    html: "<p>Test</p>",
  },
  emailClient,
);
