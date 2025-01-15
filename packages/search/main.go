package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/semhub/packages/search/internal/auth"
	"github.com/semhub/packages/search/pkg/types"
)

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if err := auth.VerifyHeaders(request.Headers); err != nil {
		fmt.Printf("Authentication failed: %v\n", err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Authentication failed",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 401,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}

	// Parse the request body
	var requestBody types.SearchRequest
	if err := json.Unmarshal([]byte(request.Body), &requestBody); err != nil {
		fmt.Printf("Failed to parse request body: %v\n", err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   err.Error(),
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}
	// print embedding
	fmt.Printf("Embedding: %v\n", requestBody.Embedding)
	fmt.Printf("SQL Query: %v\n", requestBody.SqlQuery)

	return events.APIGatewayProxyResponse{
		StatusCode: 401,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}, nil
	successResp := types.SuccessResponse{
		Success: true,
	}
	body, _ := json.Marshal(successResp)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		Body: string(body),
	}, nil
}

func main() {
	lambda.Start(handler)
}
