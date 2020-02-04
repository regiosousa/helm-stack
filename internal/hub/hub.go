package hub

import (
	"context"
	"encoding/json"
)

// Hub provides an API to manage repositories, packages, etc.
type Hub struct {
	db DB
}

// New creates a new Hub instance.
func New(db DB) *Hub {
	return &Hub{
		db: db,
	}
}

// GetChartRepositoryByName returns the chart repository identified by the name
// provided.
func (h *Hub) GetChartRepositoryByName(ctx context.Context, name string) (*ChartRepository, error) {
	var r *ChartRepository
	err := h.dbQueryUnmarshal(ctx, &r, "select get_chart_repository_by_name($1)", name)
	return r, err
}

// GetChartRepositories returns all available chart repositories.
func (h *Hub) GetChartRepositories(ctx context.Context) ([]*ChartRepository, error) {
	var r []*ChartRepository
	err := h.dbQueryUnmarshal(ctx, &r, "select get_chart_repositories()")
	return r, err
}

// GetChartRepositoryPackagesDigest returns the digests for all packages in the
// repository identified by the id provided.
func (h *Hub) GetChartRepositoryPackagesDigest(ctx context.Context, chart_repository_id string) (map[string]string, error) {
	pd := make(map[string]string)
	err := h.dbQueryUnmarshal(ctx, &pd, "select get_chart_repository_packages_digest($1)", chart_repository_id)
	return pd, err
}

// GetStatsJSON returns a json object describing the number of packages and
// releases available in the database. The json object is built by the database.
func (h *Hub) GetStatsJSON(ctx context.Context) ([]byte, error) {
	return h.dbQueryJSON(ctx, "select get_stats()")
}

// SearchPackagesJSON returns a json object with the search results produced by
// the query provided. The json object is built by the database.
func (h *Hub) SearchPackagesJSON(ctx context.Context, query *Query) ([]byte, error) {
	queryJSON, _ := json.Marshal(query)
	return h.dbQueryJSON(ctx, "select search_packages($1)", queryJSON)
}

// RegisterPackage registers the package provided in the database.
func (h *Hub) RegisterPackage(ctx context.Context, pkg *Package) error {
	return h.dbExec(ctx, "select register_package($1)", pkg)
}

// GetPackageJSON returns the package identified by the id provided as a json
// object. The json object is built by the database.
func (h *Hub) GetPackageJSON(ctx context.Context, packageID string) ([]byte, error) {
	return h.dbQueryJSON(ctx, "select get_package($1)", packageID)
}

// GetPackageVersionJSON returns the package identified by the id and version
// provided as a json object. The json object is built by the database.
func (h *Hub) GetPackageVersionJSON(ctx context.Context, packageID, version string) ([]byte, error) {
	return h.dbQueryJSON(ctx, "select get_package_version($1, $2)", packageID, version)
}

// dbQueryJSON is a helper that executes the query provided and returns a bytes
// slice containing the json data returned from the database.
func (h *Hub) dbQueryJSON(ctx context.Context, query string, args ...interface{}) ([]byte, error) {
	var jsonData []byte
	if err := h.db.QueryRow(ctx, query, args...).Scan(&jsonData); err != nil {
		return nil, err
	}
	return jsonData, nil
}

// dbQueryUnmarshal is a helper that executes the query provided and unmarshals
// the json data returned from the database into the value (v) provided.
func (h *Hub) dbQueryUnmarshal(ctx context.Context, v interface{}, query string, args ...interface{}) error {
	jsonData, err := h.dbQueryJSON(ctx, query, args...)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(jsonData, &v); err != nil {
		return err
	}
	return nil
}

// dbExec is a helper that executes the query provided encoding the argument as
// json.
func (h *Hub) dbExec(ctx context.Context, query string, arg interface{}) error {
	jsonArg, err := json.Marshal(arg)
	if err != nil {
		return err
	}
	_, err = h.db.Exec(ctx, query, jsonArg)
	return err
}