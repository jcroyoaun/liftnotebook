// in exerciselib/cmd/api/metrics.go
package main

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Define the two metrics we care about.
var (
	http_requests_total = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "exerciselib_http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		// We label by method, path, and status code.
		[]string{"method", "path", "status_code"},
	)

	http_request_duration_seconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "exerciselib_http_request_duration_seconds",
			Help: "Histogram of HTTP request latencies.",
			// Define the "buckets" (time slots) for the histogram
			// This is a good default set for a web service (5ms to 10s)
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method", "path", "status_code"},
	)
)
