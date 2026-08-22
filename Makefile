# Aldi Buildschmiede — common developer targets
# Usage: make build | check | test | zip | pipeline
# Prefers scripts/*.sh; on Windows without make, use scripts/*.ps1 instead.

PYTHON ?= python3
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SHELL := /bin/bash

.PHONY: build check test zip pipeline help

help:
	@echo "Targets:"
	@echo "  make build     assemble index.html + synergien.html"
	@echo "  make check     JS syntax + optional luac on addon Lua"
	@echo "  make test      same as check (CI-friendly alias)"
	@echo "  make zip       rebuild AscBuildschmiede.zip from addon/"
	@echo "  make pipeline  offline (+ optional DBC) data pipelines"
	@echo ""
	@echo "Windows: .\\scripts\\build.ps1 | check.ps1 | pipeline-all.ps1 | sync-addon.ps1"

build:
	@bash "$(ROOT)/scripts/build.sh"

check:
	@bash "$(ROOT)/scripts/check.sh"

test: check

zip:
	@rm -f "$(ROOT)/AscBuildschmiede.zip"
	@cd "$(ROOT)/addon" && zip -r -q "$(ROOT)/AscBuildschmiede.zip" AscBuildschmiede
	@echo "OK: AscBuildschmiede.zip"

pipeline:
	@bash "$(ROOT)/scripts/pipeline-all.sh"
