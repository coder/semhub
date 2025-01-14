package main

import (
	"fmt"

	"github.com/sst/sst/v3/sdk/golang/resource"
)

// GetSecret retrieves a regular secret value from SST resources
func GetSecret(name string) (string, error) {
	val, err := resource.Get(name)
	if err != nil {
		return "", err
	}
	if secretMap, ok := val.(map[string]interface{}); ok {
		if value, ok := secretMap["value"].(string); ok {
			return value, nil
		}
	}
	return "", fmt.Errorf("invalid secret format for %s", name)
}

// GetKeysSecret retrieves a specific property from the Keys secret
func GetKeysSecret(property string) (string, error) {
	val, err := resource.Get("Keys")
	if err != nil {
		return "", err
	}

	if props, ok := val.(map[string]interface{}); ok {
		if value, ok := props[property].(string); ok {
			return value, nil
		}
	}
	return "", fmt.Errorf("invalid Keys secret format for property: %s", property)
}
