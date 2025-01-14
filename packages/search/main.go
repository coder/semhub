package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type ErrorResponse struct {
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

type SuccessResponse struct {
	Message string `json:"message"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if err := VerifyHeaders(request.Headers); err != nil {
		fmt.Printf("Authentication failed: %v\n", err)
		errResp := ErrorResponse{
			Message: "Authentication failed",
			Error:   "Unauthorized",
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

	// Print the raw body for debugging
	fmt.Printf("Raw request body: %s\n", request.Body)
	// Parse the request body
	var requestBody struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal([]byte(request.Body), &requestBody); err != nil {
		fmt.Printf("Failed to parse request body: %v\n", err)
		errResp := ErrorResponse{
			Message: "Invalid request body",
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

	fmt.Printf("Received query: %s\n", requestBody.Query)

	successResp := SuccessResponse{
		Message: "Hello from search lambda!",
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
