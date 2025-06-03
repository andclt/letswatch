package main

import (
	"flag"
	"log/slog"
	"os"
	"strings"
)

func isEnabled(env string) bool {
	val := strings.ToLower(os.Getenv(env))
	return val == "true" || val == "1" || val == "yes" || val == "on"
}

func setupLogger() *slog.Logger {
	level := slog.LevelInfo
	if isEnabled("DEBUG") {
		level = slog.LevelDebug
	}

	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
}

func setupAddress() *string {
	if isEnabled("USE_LOCAL") {
		return flag.String("addr", "localhost:8080", "http service address")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return flag.String("addr", ":"+port, "http service address")
}

func loadAllowedOrigins() map[string]bool {
	origins := map[string]bool{
		"http://localhost:8080": true,
	}

	if extOriginsEnv := os.Getenv("CHROME_EXTENSION"); extOriginsEnv != "" {
		extOrigins := strings.Split(extOriginsEnv, ",")
		for _, origin := range extOrigins {
			origins[origin] = true
		}
	}

	return origins
}
