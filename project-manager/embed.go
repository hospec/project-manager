package main

import "embed"

//go:embed frontend/dist/*
var staticFiles embed.FS
