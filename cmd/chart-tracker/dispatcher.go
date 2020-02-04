package main

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
	"github.com/tegioz/hub/internal/hub"
	"golang.org/x/time/rate"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/repo"
)

// job represents a job for processing a given chart version in the provided
// repository. Jobs are created by the dispatcher that will eventually be
// handled by a worker.
type job struct {
	repo         *hub.ChartRepository
	chartVersion *repo.ChartVersion
}

// dispatcher is in charge of generating jobs and dispatching them among the
// available workers.
type dispatcher struct {
	ctx    context.Context
	hubApi *hub.Hub
	Queue  chan *job
}

// newDispatcher creates a new dispatcher instance.
func newDispatcher(ctx context.Context, hubApi *hub.Hub) *dispatcher {
	return &dispatcher{
		ctx:    ctx,
		hubApi: hubApi,
		Queue:  make(chan *job),
	}
}

// run instructs the dispatcher to start processing the repositories provided.
func (d *dispatcher) run(wg *sync.WaitGroup, reposNames []string) {
	defer wg.Done()

	// Get repositories to scan for charts to track
	repos, err := d.getRepositories(reposNames)
	if err != nil {
		log.Error().
			Err(err).
			Str("repos", strings.Join(reposNames, ",")).
			Msg("Error getting repositories")
		return
	}

	// Track repositories charts
	var wgRepos sync.WaitGroup
	limiter := rate.NewLimiter(25, 25)
	for _, r := range repos {
		if err := limiter.Wait(d.ctx); err != nil {
			log.Error().Err(err).Msg("Error waiting for limiter")
			return
		}
		wgRepos.Add(1)
		go d.trackRepositoryCharts(&wgRepos, r)
	}

	wgRepos.Wait()
	close(d.Queue)
}

// getRepositories returns the details of the repositories provided. If no
// repositories are provided, all available in the database will be used.
func (d *dispatcher) getRepositories(names []string) ([]*hub.ChartRepository, error) {
	var repos []*hub.ChartRepository

	if len(names) > 0 {
		for _, name := range names {
			repo, err := d.hubApi.GetChartRepositoryByName(d.ctx, name)
			if err != nil {
				return nil, err
			}
			repos = append(repos, repo)
		}
	} else {
		var err error
		repos, err = d.hubApi.GetChartRepositories(d.ctx)
		if err != nil {
			return nil, err
		}
	}

	return repos, nil
}

// trackRepositoryCharts generates jobs for each of the chart versions found in
// the given repository, provided that that version has not been already
// processed and its digest has not changed.
func (d *dispatcher) trackRepositoryCharts(wg *sync.WaitGroup, r *hub.ChartRepository) {
	defer wg.Done()

	log.Info().Str("repo", r.Name).Msg("Loading chart repository index file")
	indexFile, err := loadIndexFile(r.URL)
	if err != nil {
		log.Error().Err(err).Str("repo", r.Name).Msg("Error loading repository index file")
		return
	}
	log.Info().Str("repo", r.Name).Msg("Loading registered packages digest")
	packagesDigest, err := d.hubApi.GetChartRepositoryPackagesDigest(d.ctx, r.ChartRepositoryID)
	if err != nil {
		log.Error().Err(err).Str("repo", r.Name).Msg("Error getting repository packages digest")
		return
	}
	for _, chartVersions := range indexFile.Entries {
		for _, chartVersion := range chartVersions {
			key := fmt.Sprintf("%s@%s", chartVersion.Metadata.Name, chartVersion.Metadata.Version)
			if chartVersion.Digest != packagesDigest[key] {
				d.Queue <- &job{
					repo:         r,
					chartVersion: chartVersion,
				}
			}
			select {
			case <-d.ctx.Done():
				return
			default:
			}
		}
	}
}

// loadIndexFile downloads and parses the index file of the provided repository.
func loadIndexFile(repoURL string) (*repo.IndexFile, error) {
	repoConfig := &repo.Entry{URL: repoURL}
	getters := getter.All(&cli.EnvSettings{})
	chartRepository, err := repo.NewChartRepository(repoConfig, getters)
	if err != nil {
		return nil, err
	}
	path, err := chartRepository.DownloadIndexFile()
	if err != nil {
		return nil, err
	}
	indexFile, err := repo.LoadIndexFile(path)
	if err != nil {
		return nil, err
	}
	return indexFile, nil
}