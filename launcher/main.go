// MisTsiM.exe: the web app embedded in one file. Serves it on a local port and
// opens it in a borderless Edge/Chrome app window (or the default browser).
// Exits by itself shortly after the window is closed.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed web
var web embed.FS

const beat = `<script>setInterval(function(){fetch('/__alive').catch(function(){})},2000)</script></body>`

func main() {
	root, _ := fs.Sub(web, "web")
	var last atomic.Int64
	last.Store(time.Now().Add(60 * time.Second).UnixNano()) // grace period for the browser to start

	mux := http.NewServeMux()
	mux.HandleFunc("/__alive", func(w http.ResponseWriter, r *http.Request) {
		last.Store(time.Now().UnixNano())
		w.WriteHeader(204)
	})
	files := http.FileServer(http.FS(root))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			b, _ := fs.ReadFile(root, "index.html")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, strings.Replace(string(b), "</body>", beat, 1))
			return
		}
		files.ServeHTTP(w, r)
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		os.Exit(1)
	}
	url := "http://" + ln.Addr().String() + "/"
	fmt.Println(url)
	go http.Serve(ln, mux)
	open(url)

	// Hidden tabs throttle timers, so allow a long gap before giving up.
	for {
		time.Sleep(2 * time.Second)
		if time.Since(time.Unix(0, last.Load())) > 90*time.Second {
			return
		}
	}
}

func open(url string) {
	var candidates []string
	for _, base := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
		if base == "" {
			continue
		}
		candidates = append(candidates,
			filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
	}
	profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "MisTsiM", "profile")
	for _, exe := range candidates {
		if _, err := os.Stat(exe); err == nil {
			cmd := exec.Command(exe, "--app="+url, "--window-size=1168,700", "--user-data-dir="+profile, "--no-first-run", "--no-default-browser-check")
			if cmd.Start() == nil {
				return
			}
		}
	}
	exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
