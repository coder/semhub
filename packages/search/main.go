package main

import (
	"context"
	"runtime"

	"github.com/aws/aws-lambda-go/lambda"
)

type Event struct {
	Query string `json:"query"`
}

type Response struct {
	Message   string `json:"message"`
	Error     string `json:"error,omitempty"`
	GoVersion string `json:"goVersion"`
	DbUrl     string `json:"dbUrl"`
}

func handler(ctx context.Context, event Event) (Response, error) {
	dbUrl, err := GetSecret("DATABASE_URL")
	if err != nil {
		return Response{
			Message:   "Hello from search lambdazz!",
			GoVersion: runtime.Version(),
			Error:     err.Error(),
		}, nil
	}

	return Response{
		Message:   "Hello from search lambdazz!",
		GoVersion: runtime.Version(),
		DbUrl:     dbUrl,
	}, nil
}

func main() {
	lambda.Start(handler)
}
