import { HTTPException } from "hono/http-exception";

import type { AwsLambdaConfig } from "./util/aws";

interface LambdaErrorResponse {
  message: string;
  error?: string;
}

interface LambdaSuccessResponse {
  message: string;
}

type LambdaResponse = LambdaErrorResponse | LambdaSuccessResponse;

export async function invokeLambdaSearch(
  query: string,
  embedding: number[],
  lambdaConfig: AwsLambdaConfig,
) {
  const { lambdaInvokeSecret, lambdaUrl } = lambdaConfig;
  const response = await fetch(lambdaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lambdaInvokeSecret}`,
    },
    body: JSON.stringify({ query, embedding }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    if (response.status === 401) {
      console.error(
        "Lambda authentication failed",
        response.status,
        response.statusText,
        responseText,
      );
      throw new HTTPException(502, { message: "Search service unavailable" });
    }
    console.error(
      "Lambda invocation failed",
      response.status,
      response.statusText,
      responseText,
    );
    throw new HTTPException(502, { message: "Search service unavailable" });
  }

  const jsonResponse = await response.json();
  return jsonResponse as LambdaResponse;
  // TODO: mnormalise response results
  // const jsonResponse = await response.json();
  // try {
  //   return searchResultSchema.parse(jsonResponse);
  // } catch (error) {
  //   console.error("Invalid lambda response format:", error);
  //   throw new HTTPException(502, {
  //     message: "Search service returned invalid response",
  //   });
  // }
}
