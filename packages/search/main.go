package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/lambda"
)

type Event struct {
	Query   string            `json:"query"`
	Headers map[string]string `json:"headers"`
}

type Response struct {
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func handler(ctx context.Context, event Event) (Response, error) {
	if err := VerifyLambdaAuth(event.Headers); err != nil {
		fmt.Printf("Authentication failed: %v\n", err)
		return Response{
			Message: "Authentication failed",
			Error:   err.Error(),
		}, nil
	}

	// dbUrl, err := GetSecret("DATABASE_URL")
	// if err != nil {
	// 	return Response{
	// 		Message: "Failed to get database URL",
	// 		Error:   err.Error(),
	// 	}, nil
	// }

	return Response{
		Message: "Hello from search lambda!",
	}, nil
}

func main() {
	lambda.Start(handler)
}
