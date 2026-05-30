#!/bin/bash

# Find All Local Git Repositories
# Searches common locations and returns paths

SEARCH_PATHS=(
  "$HOME/projects"
  "$HOME/dev"
  "$HOME/work"
  "$HOME/git"
  "/tmp"
  "."
)

echo "Searching for git repositories..."
echo ""

FOUND_REPOS=()

for SEARCH_PATH in "${SEARCH_PATHS[@]}"; do
  if [ ! -d "$SEARCH_PATH" ]; then
    continue
  fi

  while IFS= read -r -d '' repo; do
    REPO_DIR=$(dirname "$repo")
    if [ -d "$REPO_DIR" ]; then
      FOUND_REPOS+=("$REPO_DIR")
      echo "Found: $REPO_DIR"
    fi
  done < <(find "$SEARCH_PATH" -maxdepth 3 -name ".git" -type d -print0 2>/dev/null)
done

echo ""
echo "Found ${#FOUND_REPOS[@]} repositories"
echo ""
echo "To audit all found repos:"
echo "  ./multi-repo-audit.sh ${FOUND_REPOS[@]}"
echo ""
echo "Or specify repos individually:"
echo "  ./multi-repo-audit.sh /path/to/repo1 /path/to/repo2"
echo ""
