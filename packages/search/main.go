package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/coder/hnsw"
	_ "github.com/lib/pq"
	"github.com/semhub/packages/search/internal/auth"
	"github.com/semhub/packages/search/internal/secrets"
	"github.com/semhub/packages/search/internal/storage"
	"github.com/semhub/packages/search/pkg/types"
)

// RowData holds the data for each row
type RowData struct {
	ID              sql.NullString  `json:"id"`
	Number          sql.NullFloat64 `json:"number"`
	Title           sql.NullString  `json:"title"`
	Labels          sql.NullString  `json:"labels"`
	IssueURL        sql.NullString  `json:"issueUrl"`
	Author          sql.NullString  `json:"author"`
	IssueState      sql.NullString  `json:"issueState"`
	StateReason     sql.NullString  `json:"stateReason"`
	CreatedAt       sql.NullTime    `json:"createdAt"`
	ClosedAt        sql.NullTime    `json:"closedAt"`
	UpdatedAt       sql.NullTime    `json:"updatedAt"`
	Name            sql.NullString  `json:"name"`
	RepoURL         sql.NullString  `json:"repoUrl"`
	OwnerLogin      sql.NullString  `json:"ownerLogin"`
	LastSyncedAt    sql.NullTime    `json:"lastSyncedAt"`
	CommentCount    sql.NullFloat64 `json:"commentCount"`
	EmbeddingString sql.NullString  `json:"-"`
	Embedding       []float32       `json:"embedding"`
	Distance        float32         `json:"distance,omitempty"`
}

// Convert database row to SuccessResponseData
func rowToResponseData(row RowData, distance float32) types.SuccessResponseData {
	// Only handle nullable (pointer) fields
	var stateReason *string
	if row.StateReason.Valid {
		s := row.StateReason.String
		stateReason = &s
	}

	var closedAt *time.Time
	if row.ClosedAt.Valid {
		t := row.ClosedAt.Time
		closedAt = &t
	}

	var lastSyncedAt *time.Time
	if row.LastSyncedAt.Valid {
		t := row.LastSyncedAt.Time
		lastSyncedAt = &t
	}

	// For required fields, we should error if they're NULL
	// but for now we'll use zero values
	return types.SuccessResponseData{
		// Required fields - these should not be NULL in the database
		Id:             row.ID.String,
		Number:         float32(row.Number.Float64),
		Title:          row.Title.String,
		IssueUrl:       row.IssueURL.String,
		IssueState:     row.IssueState.String,
		IssueCreatedAt: row.CreatedAt.Time,
		IssueUpdatedAt: row.UpdatedAt.Time,
		RepoName:       row.Name.String,
		RepoUrl:        row.RepoURL.String,
		RepoOwnerName:  row.OwnerLogin.String,
		CommentCount:   float32(row.CommentCount.Float64),

		// Optional fields - these can be NULL
		IssueStateReason: stateReason,  // *string
		IssueClosedAt:    closedAt,     // *time.Time
		RepoLastSyncedAt: lastSyncedAt, // *time.Time

		// Computed fields
		SimilarityScore: 1.0 - distance,
		// RankingScore will be calculated later

		// TODO: Handle Labels and Author which are complex types
		Labels: []types.SuccessResponseDataLabels{}, // Parse from row.Labels.String
		Author: nil,                                 // Parse from row.Author.String
	}
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	start := time.Now()
	defer func() {
		fmt.Printf("Total function execution time: %v\n", time.Since(start))
	}()

	if err := auth.VerifyHeaders(request.Headers); err != nil {
		fmt.Printf("Authentication failed: %v\n", err)
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

	// Parse the request body
	var requestBody types.SearchRequest
	if err := json.Unmarshal([]byte(request.Body), &requestBody); err != nil {
		fmt.Printf("Failed to parse request body: %v\n", err)
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

	fmt.Printf("Received query: %s\n", requestBody.SqlQuery)

	dbUrl, err := secrets.GetSecret("DATABASE_URL")
	if err != nil {
		fmt.Printf("Failed to get database URL: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: "Failed to get database URL",
		}, nil
	}

	sessionPoolerDbUrl := storage.UseSessionPooler(dbUrl)

	// Validate SQL query is SELECT only
	if !strings.HasPrefix(strings.TrimSpace(strings.ToUpper(requestBody.SqlQuery)), "SELECT") {
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

	// Connect to database
	dbStart := time.Now()
	db, err := sql.Open("postgres", sessionPoolerDbUrl)
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
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
	defer db.Close()
	fmt.Printf("Database connection time: %v\n", time.Since(dbStart))

	// Execute query
	queryStart := time.Now()
	rows, err := db.QueryContext(ctx, requestBody.SqlQuery)
	if err != nil {
		fmt.Printf("Failed to execute query: %v\n", err)
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
	fmt.Printf("Query execution time: %v\n", time.Since(queryStart))

	// Get column information
	columns, err := rows.Columns()
	if err != nil {
		fmt.Printf("Failed to get column info: %v\n", err)
		errResp := types.ErrorResponse{
			Success: false,
			Error:   "Failed to get result structure",
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

	fmt.Printf("Query returned %d columns: %v\n", len(columns), columns)

	// Store all rows and prepare nodes for HNSW
	var allRows []RowData
	var nodes []hnsw.Node[int]

	indexStart := time.Now()
	rowIdx := 0
	// TODO: optimize by running in parallel
	// determine optimal memory + cores later
	for rows.Next() {
		var row RowData
		err := rows.Scan(
			&row.ID,
			&row.Number,
			&row.Title,
			&row.Labels,
			&row.IssueURL,
			&row.Author,
			&row.IssueState,
			&row.StateReason,
			&row.CreatedAt,
			&row.ClosedAt,
			&row.UpdatedAt,
			&row.Name,
			&row.RepoURL,
			&row.OwnerLogin,
			&row.LastSyncedAt,
			&row.CommentCount,
			&row.EmbeddingString,
		)
		if err != nil {
			fmt.Printf("Error scanning row: %v\n", err)
			continue
		}

		// Custom scanner for float32 array
		var embeddings []float32
		decoder := json.NewDecoder(strings.NewReader(row.EmbeddingString.String))
		decoder.UseNumber() // Use Number interface to prevent float64 conversion

		// First decode into a []json.Number
		var rawNumbers []json.Number
		if err := decoder.Decode(&rawNumbers); err != nil {
			fmt.Printf("Error parsing embedding for row %d: %v\n", rowIdx, err)
			continue
		}

		// Convert json.Number directly to float32
		embeddings = make([]float32, len(rawNumbers))
		for i, num := range rawNumbers {
			val, err := num.Float64()
			if err != nil {
				fmt.Printf("Error converting number to float for row %d: %v\n", rowIdx, err)
				continue
			}
			embeddings[i] = float32(val)
		}

		row.Embedding = embeddings
		allRows = append(allRows, row)

		// Create node for HNSW
		nodes = append(nodes, hnsw.MakeNode(rowIdx, embeddings))
		rowIdx++
	}
	if err = rows.Err(); err != nil {
		fmt.Printf("Error iterating rows: %v\n", err)
	}

	// Bulk insert all nodes into HNSW graph
	g := hnsw.NewGraph[int]()
	g.Add(nodes...)
	fmt.Printf("Indexed %d rows in %v\n", len(allRows), time.Since(indexStart))

	// Convert request embedding from float64 to float32
	searchEmbedding := make([]float32, len(requestBody.Embedding))
	for i, v := range requestBody.Embedding {
		searchEmbedding[i] = float32(v)
	}

	// Get top 120 nearest neighbors for scoring
	searchStart := time.Now()
	neighbors := g.Search(searchEmbedding, 120)
	fmt.Printf("Found %d nearest neighbors in %v\n", len(neighbors), time.Since(searchStart))

	// Create result with distances and convert to response type
	var results []types.SuccessResponseData
	for _, n := range neighbors {
		// Calculate cosine distance manually
		// 1 - dot product is the cosine distance since vectors are normalized
		var dotProduct float32
		for i, v := range n.Value {
			dotProduct += v * searchEmbedding[i]
		}
		distance := 1 - dotProduct

		row := allRows[n.Key]
		results = append(results, rowToResponseData(row, distance))
	}

	// TODO: Calculate ranking scores and sort results

	// Return results
	successResp := types.SuccessResponse{
		Success:    true,
		Data:       results[:100], // Return top 100 after ranking
		TotalCount: float32(len(allRows)),
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
