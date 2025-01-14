package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
)

type Event struct {
	Query string `json:"query"`
}

type Response struct {
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func handler(ctx context.Context, event Event) (Response, error) {
	return Response{
		Message: "Hello from search lambda!",
	}, nil
}

func main() {
	lambda.Start(handler)
}
