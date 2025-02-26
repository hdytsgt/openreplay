package storage

import (
	"github.com/prometheus/client_golang/prometheus"
	"openreplay/backend/pkg/metrics/common"
)

var storageSessionSize = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "session_size_bytes",
		Help:      "A histogram displaying the size of each session file in bytes prior to any manipulation.",
		Buckets:   common.DefaultSizeBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionSize(fileSize float64, fileType string) {
	storageSessionSize.WithLabelValues(fileType).Observe(fileSize)
}

var storageTotalSessions = prometheus.NewCounter(
	prometheus.CounterOpts{
		Namespace: "storage",
		Name:      "sessions_total",
		Help:      "A counter displaying the total number of all processed sessions.",
	},
)

func IncreaseStorageTotalSessions() {
	storageTotalSessions.Inc()
}

var storageSkippedSessionSize = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "session_size_bytes",
		Help:      "A histogram displaying the size of each skipped session file in bytes.",
		Buckets:   common.DefaultSizeBuckets,
	},
	[]string{"file_type"},
)

func RecordSkippedSessionSize(fileSize float64, fileType string) {
	storageSkippedSessionSize.WithLabelValues(fileType).Observe(fileSize)
}

var storageTotalSkippedSessions = prometheus.NewCounter(
	prometheus.CounterOpts{
		Namespace: "storage",
		Name:      "sessions_skipped_total",
		Help:      "A counter displaying the total number of all skipped sessions because of the size limits.",
	},
)

func IncreaseStorageTotalSkippedSessions() {
	storageTotalSkippedSessions.Inc()
}

var storageSessionReadDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "read_duration_seconds",
		Help:      "A histogram displaying the duration of reading for each session in seconds.",
		Buckets:   common.DefaultDurationBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionReadDuration(durMillis float64, fileType string) {
	storageSessionReadDuration.WithLabelValues(fileType).Observe(durMillis / 1000.0)
}

var storageSessionSortDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "sort_duration_seconds",
		Help:      "A histogram displaying the duration of sorting for each session in seconds.",
		Buckets:   common.DefaultDurationBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionSortDuration(durMillis float64, fileType string) {
	storageSessionSortDuration.WithLabelValues(fileType).Observe(durMillis / 1000.0)
}

var storageSessionEncodeDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "encode_duration_seconds",
		Help:      "A histogram displaying the duration of encoding for each session in seconds.",
		Buckets:   common.DefaultDurationBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionEncodeDuration(durMillis float64, fileType string) {
	storageSessionEncodeDuration.WithLabelValues(fileType).Observe(durMillis / 1000.0)
}

var storageSessionCompressDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "compress_duration_seconds",
		Help:      "A histogram displaying the duration of compressing for each session in seconds.",
		Buckets:   common.DefaultDurationBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionCompressDuration(durMillis float64, fileType string) {
	storageSessionCompressDuration.WithLabelValues(fileType).Observe(durMillis / 1000.0)
}

var storageSessionUploadDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "storage",
		Name:      "upload_duration_seconds",
		Help:      "A histogram displaying the duration of uploading to s3 for each session in seconds.",
		Buckets:   common.DefaultDurationBuckets,
	},
	[]string{"file_type"},
)

func RecordSessionUploadDuration(durMillis float64, fileType string) {
	storageSessionUploadDuration.WithLabelValues(fileType).Observe(durMillis / 1000.0)
}

func List() []prometheus.Collector {
	return []prometheus.Collector{
		storageSessionSize,
		storageTotalSessions,
		storageSessionReadDuration,
		storageSessionSortDuration,
		storageSessionEncodeDuration,
		storageSessionCompressDuration,
		storageSessionUploadDuration,
	}
}
