package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/coder/hnsw"
	_ "github.com/lib/pq"
	"github.com/semhub/packages/search/internal/auth"
	"github.com/semhub/packages/search/internal/ranking"
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
	// Parse Labels if present
	var labels []types.SuccessResponseDataLabels
	if row.Labels.Valid && row.Labels.String != "" {
		if err := json.Unmarshal([]byte(row.Labels.String), &labels); err != nil {
			// If parsing fails, log error but continue with empty labels
			fmt.Printf("Error parsing labels: %v\n", err)
			labels = []types.SuccessResponseDataLabels{}
		}
	}

	// Parse Author if present
	var author *types.SuccessResponseDataAuthor
	if row.Author.Valid && row.Author.String != "" {
		author = &types.SuccessResponseDataAuthor{}
		if err := json.Unmarshal([]byte(row.Author.String), author); err != nil {
			// If parsing fails, log error but continue with nil author
			fmt.Printf("Error parsing author: %v\n", err)
			author = nil
		}
	}

	// Rest of the existing nullable field handling
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

	// Calculate similarity score (1 - distance)
	similarityScore := float32(1.0 - distance)

	// Calculate recency score using exponential decay
	// exp(-t/τ) where t is time elapsed in days and τ is the characteristic decay time
	timeSinceUpdate := time.Since(row.UpdatedAt.Time)
	recencyScore := float32(math.Exp(
		-1.0 * float64(timeSinceUpdate.Seconds()) /
			float64(86400*ranking.Config.TimeConstants.RecencyBaseDays),
	))

	// Calculate comment score using logarithmic normalization
	// ln(x + 1) / ln(51) to normalize to 0-1 range
	commentCount := float32(row.CommentCount.Float64)
	commentScore := float32(math.Log(float64(commentCount+1)) / math.Log(51))

	// Calculate issue state multiplier
	var stateMultiplier float32
	if row.IssueState.String == "OPEN" {
		stateMultiplier = float32(ranking.Config.ScoreMultipliers.OpenIssue)
	} else {
		stateMultiplier = float32(ranking.Config.ScoreMultipliers.ClosedIssue)
	}

	// Calculate final ranking score
	rankingScore := float32(ranking.Config.Weights.SemanticSimilarity)*similarityScore +
		float32(ranking.Config.Weights.Recency)*recencyScore +
		float32(ranking.Config.Weights.CommentCount)*commentScore +
		float32(ranking.Config.Weights.IssueState)*stateMultiplier

	// Create response with all the scores
	return types.SuccessResponseData{
		// Required fields remain the same
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

		// Optional fields
		IssueStateReason: stateReason,
		IssueClosedAt:    closedAt,
		RepoLastSyncedAt: lastSyncedAt,

		// Now properly parsed complex types
		Labels: labels,
		Author: author,

		RankingScore: rankingScore,
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
	db, err := sql.Open("postgres", sessionPoolerDbUrl)
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
	defer db.Close()
	fmt.Printf("Database connection established in %v\n", time.Since(dbConnectStart))

	// Query execution
	queryStart := time.Now()
	rows, err := db.QueryContext(ctx, requestBody.SqlQuery)
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
	fmt.Printf("Query execution completed in %v\n", time.Since(queryStart))

	// Row processing and HNSW indexing
	processingStart := time.Now()
	var allRows []RowData
	var nodes []hnsw.Node[int]
	rowIdx := 0
	// TODO: optimize by running in parallel
	// determine optimal memory + core later
	scanStart := time.Now()
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
	fmt.Printf("Scanned %d rows in %v\n", len(allRows), time.Since(scanStart))

	// HNSW graph building
	hnswStart := time.Now()
	g := hnsw.NewGraph[int]()
	g.Add(nodes...)
	fmt.Printf("Built HNSW graph with %d nodes in %v\n", len(nodes), time.Since(hnswStart))
	fmt.Printf("Total processing and indexing completed in %v\n", time.Since(processingStart))

	// Vector search
	searchStart := time.Now()
	// Convert request embedding
	searchEmbedding := make([]float32, len(requestBody.Embedding))
	for i, v := range requestBody.Embedding {
		searchEmbedding[i] = float32(v)
	}
	neighbors := g.Search(searchEmbedding, ranking.Config.SearchLimits.VectorSimilarity)
	fmt.Printf("Found %d nearest neighbors in %v\n", len(neighbors), time.Since(searchStart))

	// Result processing and ranking
	rankingStart := time.Now()
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

	// Sorting
	sortStart := time.Now()
	sort.Slice(results, func(i, j int) bool {
		return results[i].RankingScore > results[j].RankingScore
	})
	fmt.Printf("Sorted %d results in %v\n", len(results), time.Since(sortStart))
	fmt.Printf("Total ranking and processing completed in %v\n", time.Since(rankingStart))

	// Response preparation
	responseStart := time.Now()
	successResp := types.SuccessResponse{
		Success:    true,
		Data:       results,
		TotalCount: float32(len(allRows)),
	}
	body, _ := json.Marshal(successResp)
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
