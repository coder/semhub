package main

import "strings"

// useSessionPooler converts a database URL to use the session pooler (port 5432)
// instead of the transaction pooler (port 6543)
func useSessionPooler(dbUrl string) string {
	return strings.Replace(dbUrl, "6543", "5432", 1)
}
