#!/bin/sh
# Builds MisTsiM.exe (Windows, 64-bit) from the web app. Needs Go, nothing else.
set -e
cd "$(dirname "$0")"
rm -rf web && mkdir web
cp ../index.html web/ && cp -r ../src web/
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o MisTsiM.exe .
echo built launcher/MisTsiM.exe
