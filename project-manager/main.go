package main

import (
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"

	"project-manager/internal/db"
	"project-manager/internal/server"
)

func openBrowser(url string) {
	var cmd string
	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		_ = exec.Command(cmd, "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		_ = exec.Command("open", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")

	if err := db.Open(dbPath); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Get the sub-filesystem for frontend/dist
	var frontendFS fs.FS
	sub, err := fs.Sub(staticFiles, "frontend/dist")
	if err != nil {
		fmt.Println("Frontend not embedded (dev mode), serving API only.")
		frontendFS = nil
	} else {
		frontendFS = sub
	}

	handler := server.New(frontendFS)

	// Find an available port
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Failed to listen on port %s: %v", port, err)
	}

	url := fmt.Sprintf("http://localhost:%d", listener.Addr().(*net.TCPAddr).Port)
	fmt.Printf("Project Manager starting at %s\n", url)

	go func() {
		if err := http.Serve(listener, handler); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Open browser using native OS command (no external dependency)
	openBrowser(url)

	fmt.Println("Press Ctrl+C to stop the server.")

	// Wait for interrupt signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("\nShutting down...")
}
