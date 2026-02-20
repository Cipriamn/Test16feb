# Codebase Documentation

## About This Project

This is a test repository for validating multi-agent workflow orchestration. The project demonstrates coordinated file creation and QA verification workflows using the Orcha DAG system. It serves as a proof-of-concept for agent collaboration where Backend Dev creates deliverables and Backend QA validates them against exact specifications.

## Tech Stack

- **File Format**: Markdown (.md) for content and documentation
- **Version Control**: Git with worktrees for isolated branch work
- **Orchestration**: Orcha DAG-based task coordination system
  - `.orcha/` directory stores progress tracking files
  - PROGRESS.md contains agent checklists with append-only update logs
  - Agents operate independently and communicate via structured markdown
- **QA Tools**: File inspection for content verification

## What This Branch Does

This branch implements a file creation and verification task:
- Backend Dev created `sentence.md` with exact content: "everything I am testing the app"
- Backend QA verified: file existence at project root, exact content match, no extra whitespace
- Both agents completed their checklists successfully
- Validates the end-to-end agent workflow pipeline for basic file operations

## Key Files

- **`sentence.md`** - Primary deliverable containing the test sentence (31 bytes)
- **`.orcha/groups/.../PROGRESS.md`** - DAG progress with agent checklists and status updates
- **`.orcha/groups/.../CODEBASE.md`** - This codebase documentation
- **`README.md`** - Project readme
- **`requirements.md`** / **`issues.md`** - Project documentation
