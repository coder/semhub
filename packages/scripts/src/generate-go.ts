import fs from "fs";
import path from "path";
import { z } from "zod";

import {
  lambdaErrorResponseSchema,
  lambdaSearchRequestSchema,
  lambdaSuccessResponseSchema,
} from "@/core/semsearch/lambda.schema";
import { VECTOR_SIMILARITY_SEARCH_LIMIT } from "@/core/semsearch/params";
import {
  RANKING_WEIGHTS,
  SCORE_MULTIPLIERS,
  TIME_CONSTANTS,
} from "@/core/semsearch/ranking";

// TODO: hook this up to build/CICD process

// Helper to convert Zod schema to Go struct
function zodToGoStruct(
  schema: z.ZodObject<any>,
  name: string,
): {
  code: string;
  usesTimePackage: boolean;
} {
  let nestedTypes = "";
  let usesTimePackage = false;

  const fields = Object.entries(schema.shape).map(([key, value]) => {
    const fieldName = key.charAt(0).toUpperCase() + key.slice(1);

    // Helper function to get Go type for a Zod schema recursively
    function getGoTypeForSchema(
      schema: z.ZodTypeAny,
      parentName: string,
    ): { type: string; usesTime: boolean } {
      // Handle transformed schemas
      if ("_def" in schema && "transform" in schema._def) {
        schema = (schema._def as any).schema;
      }

      // Handle createSelectSchema transformations
      if (
        schema instanceof z.ZodObject &&
        "_def" in schema &&
        "schema" in (schema._def as any)
      ) {
        schema = (schema._def as any).schema;
      }

      if (schema instanceof z.ZodString) {
        return { type: "string", usesTime: false };
      } else if (schema instanceof z.ZodNumber) {
        return { type: "float32", usesTime: false };
      } else if (schema instanceof z.ZodArray) {
        // Handle nested effects/transforms in array elements
        let finalElementSchema = schema.element;
        if (
          "_def" in finalElementSchema &&
          "schema" in finalElementSchema._def
        ) {
          finalElementSchema = finalElementSchema._def.schema;
        }

        const { type: elementType, usesTime } = getGoTypeForSchema(
          finalElementSchema,
          parentName,
        );
        return { type: `[]${elementType}`, usesTime };
      } else if (schema instanceof z.ZodObject) {
        const nestedName = parentName;
        const { code: nestedCode, usesTimePackage: nestedUsesTime } =
          zodToGoStruct(schema, nestedName);
        nestedTypes += nestedCode + "\n\n";
        return { type: nestedName, usesTime: nestedUsesTime };
      } else if (schema instanceof z.ZodLiteral) {
        if (typeof schema._def.value === "boolean") {
          return { type: "bool", usesTime: false };
        }
        throw new Error(
          `Unsupported literal type: ${typeof schema._def.value}`,
        );
      } else if (schema instanceof z.ZodOptional) {
        // For optional fields, we'll make them pointers in Go
        const { type: innerType, usesTime } = getGoTypeForSchema(
          schema.unwrap(),
          parentName,
        );
        // Don't add another pointer if it's already a pointer type
        return {
          type: innerType.startsWith("*") ? innerType : `*${innerType}`,
          usesTime,
        };
      } else if (schema instanceof z.ZodDate) {
        return { type: "time.Time", usesTime: true };
      } else if (schema instanceof z.ZodNullable) {
        // For nullable fields, we'll make them pointers in Go
        const { type: innerType, usesTime } = getGoTypeForSchema(
          schema.unwrap(),
          parentName,
        );
        // Don't add another pointer if it's already a pointer type
        return {
          type: innerType.startsWith("*") ? innerType : `*${innerType}`,
          usesTime,
        };
      } else if (schema instanceof z.ZodEnum) {
        // For enums, we'll use string in Go since Go doesn't have a direct enum type
        return { type: "string", usesTime: false };
      } else if (schema instanceof z.ZodUnion) {
        // For unions of literals (which often represent enums), we'll use string
        if (
          schema._def.options.every((opt: any) => opt instanceof z.ZodLiteral)
        ) {
          return { type: "string", usesTime: false };
        }
        throw new Error(
          `Unsupported union type: only literal unions are supported`,
        );
      }
      throw new Error(`Unsupported Zod type: ${schema.constructor.name}`);
    }

    const { type: goType, usesTime } = getGoTypeForSchema(
      value as z.ZodTypeAny,
      `${name}${fieldName}`,
    );
    usesTimePackage = usesTimePackage || usesTime;

    let jsonTag = `\`json:"${key}`;
    if (value instanceof z.ZodOptional) {
      jsonTag += ",omitempty";
    }
    jsonTag += `"\``;

    return `\t${fieldName} ${goType} ${jsonTag}`;
  });

  return {
    code: `${nestedTypes}type ${name} struct {
${fields.join("\n")}
}`,
    usesTimePackage,
  };
}

// Generate Lambda types
const generateLambdaTypes = () => {
  const searchRequest = zodToGoStruct(
    lambdaSearchRequestSchema,
    "SearchRequest",
  );
  const errorResponse = zodToGoStruct(
    lambdaErrorResponseSchema,
    "ErrorResponse",
  );
  const successResponse = zodToGoStruct(
    lambdaSuccessResponseSchema,
    "SuccessResponse",
  );

  const usesTimePackage =
    searchRequest.usesTimePackage ||
    errorResponse.usesTimePackage ||
    successResponse.usesTimePackage;

  const imports = usesTimePackage ? 'import "time"\n\n' : "";

  return `// Code generated by packages/scripts/src/generate-go.ts. DO NOT EDIT.
package types

${imports}${searchRequest.code}

${errorResponse.code}

${successResponse.code}
`;
};

// Generate ranking config
const generateRankingConfig =
  () => `// Code generated by packages/scripts/src/generate-go.ts. DO NOT EDIT.
package ranking

type RankingConfig struct {
	Weights struct {
		SemanticSimilarity float64
		CommentCount       float64
		Recency            float64
		IssueState         float64
	}
	TimeConstants struct {
		RecencyBaseDays int
	}
	ScoreMultipliers struct {
		OpenIssue   float64
		ClosedIssue float64
	}
	SearchLimits struct {
		VectorSimilarity int
	}
}

var Config = RankingConfig{
	Weights: struct {
		SemanticSimilarity float64
		CommentCount       float64
		Recency            float64
		IssueState         float64
	}{
		SemanticSimilarity: ${RANKING_WEIGHTS.SEMANTIC_SIMILARITY},
		CommentCount:       ${RANKING_WEIGHTS.COMMENT_COUNT},
		Recency:            ${RANKING_WEIGHTS.RECENCY},
		IssueState:         ${RANKING_WEIGHTS.ISSUE_STATE},
	},
	TimeConstants: struct {
		RecencyBaseDays int
	}{
		RecencyBaseDays: ${TIME_CONSTANTS.RECENCY_BASE_DAYS},
	},
	ScoreMultipliers: struct {
		OpenIssue   float64
		ClosedIssue float64
	}{
		OpenIssue:   ${SCORE_MULTIPLIERS.OPEN_ISSUE},
		ClosedIssue: ${SCORE_MULTIPLIERS.CLOSED_ISSUE},
	},
	SearchLimits: struct {
		VectorSimilarity int
	}{
		VectorSimilarity: ${VECTOR_SIMILARITY_SEARCH_LIMIT},
	},
}
`;

// Write files
const lambdaTypesPath = path.join(
  __dirname,
  "../../../packages/search/pkg/types/dto_gen.go",
);
fs.writeFileSync(lambdaTypesPath, generateLambdaTypes());

const rankingConfigPath = path.join(
  __dirname,
  "../../../packages/search/internal/ranking/config_gen.go",
);
fs.writeFileSync(rankingConfigPath, generateRankingConfig());
// eslint-disable-next-line no-console
console.log("Generated Go ranking config at:", rankingConfigPath);

// Run go fmt on generated files
const { execSync } = require("child_process");
const runGoFmt = (filePath: string) => {
  try {
    execSync(`go fmt ${filePath}`);
    // eslint-disable-next-line no-console
    console.log(`Formatted ${filePath} with go fmt`);
  } catch (error) {
    console.error(`Failed to run go fmt on ${filePath}:`, error);
  }
};

runGoFmt(lambdaTypesPath);
runGoFmt(rankingConfigPath);
