package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func New(staticFS fs.FS) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", healthHandler)

		r.Route("/projects", func(r chi.Router) {
			r.Get("/", listProjects)
			r.Post("/", createProject)
			r.Get("/{id}", getProject)
			r.Put("/{id}", updateProject)
			r.Delete("/{id}", deleteProject)
			r.Get("/{id}/overview", getProjectOverview)

			r.Route("/{id}/task-groups", func(r chi.Router) {
				r.Get("/", listTaskGroups)
				r.Post("/", createTaskGroup)
				r.Put("/{gid}", updateTaskGroup)
				r.Delete("/{gid}", deleteTaskGroup)
				r.Put("/reorder", reorderTaskGroups)
			})

			r.Route("/{id}/tasks", func(r chi.Router) {
				r.Get("/", listTasks)
				r.Post("/", createTask)
				r.Put("/reorder", reorderTasks)
				r.Put("/{tid}/move", moveTask)
				r.Get("/{tid}", getTask)
				r.Put("/{tid}", updateTask)
				r.Delete("/{tid}", deleteTask)
				r.Put("/{tid}/daily-notes", updateDailyNotes)
			})

			r.Route("/{id}/issues", func(r chi.Router) {
				r.Get("/", listIssues)
				r.Post("/", createIssue)
				r.Put("/{iid}", updateIssue)
				r.Delete("/{iid}", deleteIssue)
			})

			r.Route("/{id}/notes", func(r chi.Router) {
				r.Get("/", listNotes)
				r.Post("/", createNote)
				r.Put("/{nid}", updateNote)
				r.Delete("/{nid}", deleteNote)
			})

			r.Get("/{id}/calendar", getCalendar)
			
		})

		r.Route("/settings", func(r chi.Router) {
			r.Get("/phases", listPhases)
			r.Post("/phases", createPhase)
			r.Put("/phases/{pid}", updatePhase)
			r.Put("/phases/reorder", reorderPhases)
			r.Delete("/phases/{pid}", deletePhase)
			r.Get("/personnel", listPersonnel)
			r.Post("/personnel", createPersonnel)
			r.Put("/personnel/{pid}", updatePersonnel)
			r.Delete("/personnel/{pid}", deletePersonnel)
		})

		r.Get("/export/project/{id}", exportProject)
		r.Get("/export/all", exportAll)
		r.Post("/import", importData)

		// Excel routes
		r.Get("/projects/{id}/tasks/export/excel", exportTasksExcel)
		r.Post("/projects/{id}/tasks/import/excel", importTasksExcel)
		r.Get("/tasks/template/excel", getExcelTemplate)
	})

	// SPA fallback: serve index.html for non-API, non-file requests
	if staticFS != nil {
		r.NotFound(spaHandler(staticFS))
	}

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// spaHandler serves the embedded React SPA
func spaHandler(staticFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))
	return func(w http.ResponseWriter, r *http.Request) {
		// If request path has a file extension, try to serve the static file
		ext := filepath.Ext(r.URL.Path)
		if ext != "" && ext != ".html" {
			// Check if the file exists in the embedded FS
			path := strings.TrimPrefix(r.URL.Path, "/")
			f, err := staticFS.Open(path)
			if err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Serve index.html for client-side routing
		indexFile, err := staticFS.Open("index.html")
		if err != nil {
			// In dev mode without embedded frontend, return a simple message
			http.Error(w, "Frontend not built. Run 'cd frontend && npm run build' first.", http.StatusNotFound)
			return
		}
		defer indexFile.Close()

		stat, err := indexFile.Stat()
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		content, err := io.ReadAll(indexFile)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		http.ServeContent(w, r, "index.html", stat.ModTime(), strings.NewReader(string(content)))
	}
}
