import { HTTPException } from "hono/http-exception";

import type { AwsLambdaConfig } from "@/util/aws";

import {
  lambdaSuccessResponseSchema,
  type LambdaSearchRequest,
} from "./lambda.schema";

export async function inMemorySearch(
  searchRequest: LambdaSearchRequest,
  lambdaConfig: AwsLambdaConfig,
) {
  const { lambdaInvokeSecret, lambdaUrl } = lambdaConfig;
  const response = await fetch(lambdaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lambdaInvokeSecret}`,
    },
    body: JSON.stringify(searchRequest),
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
  // Validate response using schema
  try {
    const result = lambdaSuccessResponseSchema.parse(jsonResponse);
    return result;
  } catch (error) {
    console.error("Invalid lambda response format:", error);
    throw new HTTPException(502, {
      message: "Search service returned invalid response",
    });
  }
}
