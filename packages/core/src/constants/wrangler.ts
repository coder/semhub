export type WranglerSecrets = {
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  GITHUB_PERSONAL_ACCESS_TOKEN: string;
};

type ScreamingSnakeToCamelCase<S extends string> = S extends `${infer F}_${infer R}`
  ? `${Lowercase<F>}${R extends '' ? '' : Capitalize<ScreamingSnakeToCamelCase<R>>}`
  : Lowercase<S>;

export type WranglerSecretsCamelCase = {
  [K in keyof WranglerSecrets as ScreamingSnakeToCamelCase<K>]: WranglerSecrets[K];
};
