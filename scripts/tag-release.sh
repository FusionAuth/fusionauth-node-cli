#!/bin/bash
#
# Creates and pushes a release tag after a release PR has been merged.
#
# Usage: ./scripts/tag-release.sh <version>
# Example: ./scripts/tag-release.sh 1.2.3
#
# This script:
# 1. Checks out main and pulls the latest changes
# 2. Verifies the version in package.json matches the provided version
# 3. Creates the tag (without 'v' prefix)
# 4. Pushes the tag to trigger the publish workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

VERSION="$1"

# Validate version argument
if [[ -z "$VERSION" ]]; then
    echo -e "${RED}Error: Version argument required${NC}"
    echo "Usage: ./scripts/tag-release.sh <version>"
    echo "Example: ./scripts/tag-release.sh 1.2.3"
    exit 1
fi

# Validate version format (semver without 'v' prefix)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format '$VERSION'${NC}"
    echo "Version must be in semver format without 'v' prefix (e.g., 1.2.3)"
    exit 1
fi

# Check out main and pull latest
echo "Checking out main branch..."
git checkout main

echo "Pulling latest changes..."
git pull origin main

# Verify the version in package.json matches
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [[ "$PACKAGE_VERSION" != "$VERSION" ]]; then
    echo -e "${RED}Error: Version mismatch${NC}"
    echo "Requested version: $VERSION"
    echo "package.json version: $PACKAGE_VERSION"
    echo ""
    echo "Make sure the release PR has been merged before running this script."
    exit 1
fi

# Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag '$VERSION' already exists${NC}"
    exit 1
fi

# Create and push the tag
echo "Creating tag $VERSION..."
git tag "$VERSION"

echo "Pushing tag to origin..."
git push origin "$VERSION"

echo ""
echo -e "${GREEN}Tag $VERSION created and pushed!${NC}"
echo ""
echo "The GitHub Action will now build and publish to npm."
echo "Monitor the workflow: https://github.com/FusionAuth/fusionauth-node-cli/actions/workflows/publish.yaml"
