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
	DbUrl   string `json:"dbUrl"`
}

func handler(ctx context.Context, event Event) (Response, error) {
	dbUrl, err := GetSecret("DATABASE_URL")
	if err != nil {
		return Response{
			Message: "Hello from search lambda!",
			Error:   err.Error(),
		}, nil
	}

	return Response{
		Message: "Hello from search lambda!",
		DbUrl:   useSessionPooler(dbUrl),
	}, nil
}

func main() {
	lambda.Start(handler)
}
