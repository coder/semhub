export type WranglerSecrets = {
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  GITHUB_PERSONAL_ACCESS_TOKEN: string;
  RESEND_API_KEY: string;
  SEMHUB_GITHUB_APP_ID: string;
  SEMHUB_GITHUB_APP_PRIVATE_KEY: string;
};

export interface WranglerEnv extends WranglerSecrets {
  ENVIRONMENT: "dev" | "prod";
}
