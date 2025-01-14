package main

import (
	"fmt"
	"strings"
)

// VerifyHeaders verifies the bearer token in the Authorization header
func VerifyHeaders(headers map[string]string) error {
	expectedSecret, err := GetKeysSecret("lambdaInvokeSecret")
	if err != nil {
		return fmt.Errorf("failed to get lambda invoke secret: %w", err)
	}
	auth := headers["authorization"]
	if auth == "" {
		return fmt.Errorf("missing authorization header")
	}

	parts := strings.Split(auth, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return fmt.Errorf("invalid authorization header format")
	}

	if parts[1] != expectedSecret {
		return fmt.Errorf("authorization token does not match expected secret")
	}
	return nil
}
