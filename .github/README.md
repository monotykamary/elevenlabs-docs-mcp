# GitHub Workflows

This directory contains GitHub Actions workflows for automating various tasks in this repository.

## Workflows

### Docker Build and Push (`docker-build.yml`)

This workflow builds and pushes the Docker image to GitHub Container Registry.

- **Triggers**: 
  - Push to `main` branch
  - Push of any tag starting with `v`
  - Pull requests to `main` branch
- **Features**:
  - Builds the Docker image
  - Pushes to GitHub Container Registry (ghcr.io) for branches and tags (not PRs)
  - Adds appropriate tags based on git refs and semantic versioning
  - Utilizes GitHub's caching for faster builds

### Docker Vulnerability Scan (`docker-scan.yml`)

This workflow scans the Docker image for vulnerabilities.

- **Triggers**:
  - Push to `main` branch
  - Pull requests to `main` branch
  - Weekly on Sunday at midnight (cron schedule)
- **Features**:
  - Builds the Docker image
  - Scans for vulnerabilities using Trivy
  - Uploads results to GitHub Security tab
  - Focuses on CRITICAL and HIGH severity issues

## Usage

These workflows run automatically based on their triggers. No manual action is required.

For the Docker build workflow to successfully push to GitHub Container Registry, the repository needs:
1. Appropriate permissions set (already configured in the workflow)
2. The `GITHUB_TOKEN` secret, which is automatically provided by GitHub

## Image Tags

The Docker images are tagged following this convention:

- For branches: `ghcr.io/{owner}/{repo}:main` (or other branch name)
- For tags: `ghcr.io/{owner}/{repo}:1.0.0` (exact version)
- For tags: `ghcr.io/{owner}/{repo}:1.0` (major.minor)
- For all builds: `ghcr.io/{owner}/{repo}:sha-{short_sha}` (commit hash) 