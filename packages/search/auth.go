package main

import (
	"fmt"
	"strings"
)

// VerifyAuth verifies the bearer token in the Authorization header
func VerifyAuth(headers map[string]string, expectedSecret string) error {
	auth := headers["authorization"]
	if auth == "" {
		return fmt.Errorf("missing authorization header")
	}

	parts := strings.Split(auth, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return fmt.Errorf("invalid authorization header format")
	}

	if parts[1] != expectedSecret {
		return fmt.Errorf("invalid authorization token")
	}

	return fmt.Errorf("authentication unsuccessful")
	// return nil
}

// VerifyLambdaAuth retrieves the lambda invoke secret and verifies the request auth
func VerifyLambdaAuth(headers map[string]string) error {
	lambdaInvokeSecret, err := GetKeysSecret("lambdaInvokeSecret")
	if err != nil {
		return fmt.Errorf("failed to get lambda invoke secret: %w", err)
	}

	return VerifyAuth(headers, lambdaInvokeSecret)
}
