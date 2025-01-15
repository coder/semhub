package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/coder/hnsw"
	"github.com/jackc/pgx/v5"
	"github.com/semhub/packages/search/internal/auth"
	"github.com/semhub/packages/search/internal/ranking"
	"github.com/semhub/packages/search/internal/secrets"
	"github.com/semhub/packages/search/internal/storage"
	"github.com/semhub/packages/search/pkg/types"
)

// RowData holds the data for each row
type RowData struct {
	Id               string
	Number           float32
	Title            string
	Labels           []types.SuccessResponseDataLabels
	IssueUrl         string
	Author           *types.SuccessResponseDataAuthor
	IssueState       string     `db:"issue_state"`
	IssueStateReason *string    `db:"issue_state_reason"`
	IssueCreatedAt   time.Time  `db:"issue_created_at"`
	IssueClosedAt    *time.Time `db:"issue_closed_at"`
	IssueUpdatedAt   time.Time  `db:"issue_updated_at"`
	RepoName         string     `db:"name"`
	RepoUrl          string
	RepoOwnerName    string     `db:"owner_login"`
	RepoLastSyncedAt *time.Time `db:"last_synced_at"`
	CommentCount     float32    `db:"comment_count"`
	Embedding        Vector     `db:"embedding"`
}

// Vector is a custom type that implements database/sql.Scanner and encoding/json.Unmarshaler
type Vector []float32

// Scan implements the database/sql.Scanner interface.
func (v *Vector) Scan(src interface{}) error {
	if src == nil {
		*v = nil
		return nil
	}

	switch src := src.(type) {
	case string:
		return json.Unmarshal([]byte(src), v)
	case []byte:
		return json.Unmarshal(src, v)
	default:
		return fmt.Errorf("cannot scan %T into Vector", src)
	}
}

// UnmarshalJSON implements the encoding/json.Unmarshaler interface.
func (v *Vector) UnmarshalJSON(data []byte) error {
	// First try to unmarshal as array of float32
	var floats []float32
	if err := json.Unmarshal(data, &floats); err == nil {
		*v = floats
		return nil
	}

	// If that fails, try to unmarshal as array of float64 and convert
	var doubles []float64
	if err := json.Unmarshal(data, &doubles); err != nil {
		return err
	}

	// Convert float64 to float32
	floats = make([]float32, len(doubles))
	for i, d := range doubles {
		floats[i] = float32(d)
	}
	*v = floats
	return nil
}

// Convert database row to SuccessResponseData
func rowToResponseData(row RowData, requestEmbedding []float32) types.SuccessResponseData {
	// Calculate cosine distance
	var dotProduct float32
	for i, v := range row.Embedding {
		dotProduct += v * requestEmbedding[i]
	}
	distance := float32(1.0 - dotProduct)

	// Calculate similarity score (1 - distance)
	similarityScore := float32(1.0 - distance)

	// Calculate recency score using exponential decay
	// exp(-t/τ) where t is time elapsed in days and τ is the characteristic decay time
	timeSinceUpdate := time.Since(row.IssueUpdatedAt)
	recencyScore := float32(math.Exp(
		-1.0 * float64(timeSinceUpdate.Seconds()) /
			float64(86400*ranking.Config.TimeConstants.RecencyBaseDays),
	))

	// Calculate comment score using logarithmic normalization
	// ln(x + 1) / ln(51) to normalize to 0-1 range
	commentScore := float32(math.Log(float64(row.CommentCount+1)) / math.Log(51))

	// Calculate issue state multiplier
	var stateMultiplier float32
	if row.IssueState == "OPEN" {
		stateMultiplier = float32(ranking.Config.ScoreMultipliers.OpenIssue)
	} else {
		stateMultiplier = float32(ranking.Config.ScoreMultipliers.ClosedIssue)
	}

	// Calculate final ranking score
	rankingScore := float32(ranking.Config.Weights.SemanticSimilarity)*similarityScore +
		float32(ranking.Config.Weights.Recency)*recencyScore +
		float32(ranking.Config.Weights.CommentCount)*commentScore +
		float32(ranking.Config.Weights.IssueState)*stateMultiplier

	return types.SuccessResponseData{
		Id:               row.Id,
		Number:           row.Number,
		Title:            row.Title,
		Labels:           row.Labels,
		IssueUrl:         row.IssueUrl,
		Author:           row.Author,
		IssueState:       row.IssueState,
		IssueStateReason: row.IssueStateReason,
		IssueCreatedAt:   row.IssueCreatedAt,
		IssueClosedAt:    row.IssueClosedAt,
		IssueUpdatedAt:   row.IssueUpdatedAt,
		RepoName:         row.RepoName,
		RepoUrl:          row.RepoUrl,
		RepoOwnerName:    row.RepoOwnerName,
		RepoLastSyncedAt: row.RepoLastSyncedAt,
		CommentCount:     row.CommentCount,
		RankingScore:     rankingScore,
	}
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	totalStart := time.Now()
	defer func() {
		fmt.Printf("Total function execution time: %v\n", time.Since(totalStart))
	}()

	// Auth check
	authStart := time.Now()
	if err := auth.VerifyHeaders(request.Headers); err != nil {
		fmt.Printf("Authentication failed in %v: %v\n", time.Since(authStart), err)
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
	fmt.Printf("Authentication completed in %v\n", time.Since(authStart))

	// Request parsing
	parseStart := time.Now()
	var requestBody types.SearchRequest
	if err := json.Unmarshal([]byte(request.Body), &requestBody); err != nil {
		fmt.Printf("Failed to parse request body in %v: %v\n", time.Since(parseStart), err)
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
	fmt.Printf("Request parsing completed in %v\n", time.Since(parseStart))

	// Database setup
	dbSetupStart := time.Now()
	dbUrl, err := secrets.GetSecret("DATABASE_URL")
	if err != nil {
		fmt.Printf("Failed to get database URL in %v: %v\n", time.Since(dbSetupStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Failed to get database URL",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}
	sessionPoolerDbUrl := storage.UseSessionPooler(dbUrl)

	// SQL validation
	if !strings.HasPrefix(strings.TrimSpace(strings.ToUpper(requestBody.SqlQuery)), "SELECT") {
		fmt.Printf("SQL validation failed in %v\n", time.Since(dbSetupStart))
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Only SELECT queries are allowed",
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
	fmt.Printf("Database setup completed in %v\n", time.Since(dbSetupStart))

	// Database connection
	dbConnectStart := time.Now()
	config, err := pgx.ParseConfig(sessionPoolerDbUrl)
	if err != nil {
		fmt.Printf("Failed to parse database config in %v: %v\n", time.Since(dbConnectStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Database configuration failed",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}

	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		fmt.Printf("Failed to connect to database in %v: %v\n", time.Since(dbConnectStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Database connection failed",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}
	defer conn.Close(ctx)
	fmt.Printf("Database connection established in %v\n", time.Since(dbConnectStart))

	// Query execution
	queryStart := time.Now()

	// Execute query and collect rows directly into structs
	var allRows []RowData
	rows, err := conn.Query(ctx, requestBody.SqlQuery)
	if err != nil {
		fmt.Printf("Failed to execute query in %v: %v\n", time.Since(queryStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Query execution failed",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}
	defer rows.Close()
	fmt.Printf("Query 'executed' in %v\n", time.Since(queryStart))

	fmt.Printf("Collecting rows\n")
	collectRowsStart := time.Now()
	allRows, err = pgx.CollectRows(rows, pgx.RowToStructByName[RowData])
	if err != nil {
		fmt.Printf("Failed to collect rows in %v: %v\n", time.Since(queryStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Failed to collect rows",
		}
		body, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(body),
		}, nil
	}
	fmt.Printf("Collected rows in %v\n", time.Since(collectRowsStart))
	fmt.Printf("Query execution and row collection completed in %v\n", time.Since(queryStart))

	// print the length of allRows
	fmt.Printf("Length of allRows: %d\n", len(allRows))

	// Process embeddings and build HNSW graph
	processingStart := time.Now()
	nodes := make([]hnsw.Node[int], 0, len(allRows))

	for i := range allRows {
		// We can use the Embedding directly since it's already a Vector ([]float32)
		nodes = append(nodes, hnsw.MakeNode(i, allRows[i].Embedding))
	}
	fmt.Printf("Processed %d rows in %v\n", len(allRows), time.Since(processingStart))

	// HNSW graph building
	hnswStart := time.Now()
	g := hnsw.NewGraph[int]()
	g.Add(nodes...)
	fmt.Printf("Built HNSW graph with %d nodes in %v\n", len(nodes), time.Since(hnswStart))
	fmt.Printf("Total processing and indexing completed in %v\n", time.Since(processingStart))

	// Vector search
	searchStart := time.Now()
	neighbors := g.Search(requestBody.Embedding, ranking.Config.SearchLimits.VectorSimilarity)
	fmt.Printf("Found %d nearest neighbors in %v\n", len(neighbors), time.Since(searchStart))

	// Result processing and ranking
	rankingStart := time.Now()
	var results []types.SuccessResponseData
	for _, n := range neighbors {
		row := allRows[n.Key]
		results = append(results, rowToResponseData(row, requestBody.Embedding))
	}

	// Sorting
	sortStart := time.Now()
	sort.Slice(results, func(i, j int) bool {
		return results[i].RankingScore > results[j].RankingScore
	})
	fmt.Printf("Sorted %d results in %v\n", len(results), time.Since(sortStart))
	fmt.Printf("Total ranking and processing completed in %v\n", time.Since(rankingStart))

	// Prepare success response
	responseStart := time.Now()
	successResp := types.SuccessResponse{
		Success:    true,
		Data:       results,
		TotalCount: float32(len(allRows)),
	}
	body, err := json.Marshal(successResp)
	if err != nil {
		fmt.Printf("Failed to marshal response in %v: %v\n", time.Since(responseStart), err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Failed to marshal response",
		}
		errBody, _ := json.Marshal(errResp)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: string(errBody),
		}, nil
	}
	fmt.Printf("Response prepared in %v\n", time.Since(responseStart))

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
