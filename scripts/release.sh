#!/bin/bash
#
# Prepares a release by bumping the version and creating a release branch.
#
# Usage: ./scripts/release.sh [patch|minor|major]
#
# This script:
# 1. Validates you're on main with a clean working directory
# 2. Pulls the latest changes from origin
# 3. Bumps the version in package.json (without creating a git tag)
# 4. Creates a release branch (e.g., release/1.2.3)
# 5. Commits and pushes the branch
#
# After running this script, create a PR to merge the release branch into main.
# Once merged, use ./scripts/tag-release.sh to create and push the tag.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

VERSION_TYPE="${1:-patch}"

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
    echo "Usage: ./scripts/release.sh [patch|minor|major]"
    exit 1
fi

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${RED}Error: Must be on main branch (currently on '$CURRENT_BRANCH')${NC}"
    exit 1
fi

# Ensure working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit or stash your changes before releasing."
    exit 1
fi

# Fetch and check if we're up to date with origin
echo "Fetching latest changes from origin..."
git fetch origin main

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main)

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
    echo -e "${YELLOW}Local main is not up to date with origin. Pulling...${NC}"
    git pull origin main
fi

# Bump version without creating a tag
echo "Bumping $VERSION_TYPE version..."
NEW_VERSION=$(npm version "$VERSION_TYPE" --no-git-tag-version)
# npm version returns with 'v' prefix, remove it
NEW_VERSION="${NEW_VERSION#v}"

echo -e "${GREEN}Version bumped to $NEW_VERSION${NC}"

# Create release branch
BRANCH_NAME="release/$NEW_VERSION"
echo "Creating branch $BRANCH_NAME..."
git checkout -b "$BRANCH_NAME"

# Commit the version bump
git add package.json package-lock.json
git commit -m "Bump version to $NEW_VERSION"

# Push the branch
echo "Pushing branch to origin..."
git push -u origin "$BRANCH_NAME"

echo ""
echo -e "${GREEN}Release branch created and pushed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create a Pull Request: https://github.com/FusionAuth/fusionauth-node-cli/compare/main...$BRANCH_NAME"
echo "  2. After the PR is merged, run: ./scripts/tag-release.sh $NEW_VERSION"
