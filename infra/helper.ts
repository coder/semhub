export function mapStageToEnv(stage: string): "dev" | "uat" | "prod" {
  if (stage === "prod") return "prod";
  if (stage === "uat") return "uat";
  return "dev";
}
