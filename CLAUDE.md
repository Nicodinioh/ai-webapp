# CLAUDE.md

This file provides guidance for AI assistants (Claude Code and others) working in this repository.

## Repository Overview

**ai-webapp** is a Python project for experiments with OpenAI Codex for automation scripts. It is currently in early/starter state — no application source files exist yet.

- **License:** MIT (2025, Nicodinioh)
- **Primary language:** Python
- **Repository:** `nicodinioh/ai-webapp`

## Repository Structure

```
ai-webapp/
├── .gitignore        # Comprehensive Python .gitignore
├── LICENSE           # MIT License
├── README.md         # Project description
└── CLAUDE.md         # This file
```

As the project grows, expected additions include:
- `src/` or top-level Python modules for application code
- `tests/` for test files
- `requirements.txt`, `pyproject.toml`, or similar for dependencies
- `.env.example` for environment variable documentation

## Technology Stack

The `.gitignore` is pre-configured for a broad Python ecosystem. Likely tools based on it:

| Category | Tools |
|---|---|
| Package managers | pip, uv, poetry, pdm, pipenv, pixi |
| Linting/formatting | Ruff |
| Type checking | mypy, Pyre, pytype |
| Testing | pytest, tox, nox, hypothesis |
| Frameworks | Django, Flask, Scrapy (possible) |
| Notebooks | Jupyter, Marimo |
| Documentation | Sphinx, mkdocs |
| Editors | VS Code, PyCharm, Cursor |

## Development Workflow

### Branch Strategy

- `main` — stable default branch
- Feature branches follow the pattern: `<user>/<description>-<id>`
- Development branches created by Claude follow: `claude/<description>-<id>`

### Git Conventions

- Commit messages should be clear and descriptive
- Always push to the designated feature branch, never directly to `main` without permission
- Use `git push -u origin <branch-name>` for first push

### Setting Up (once dependencies are added)

```bash
# Recommended: use uv or virtualenv
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt  # or: uv sync / poetry install
```

## Code Conventions

No source code exists yet. When adding code, follow these Python best practices consistent with the tooling in `.gitignore`:

- **Formatting/linting:** Use Ruff (`ruff check .` and `ruff format .`)
- **Type annotations:** Use standard Python type hints; check with mypy
- **Tests:** Place in `tests/` directory using pytest
- **Environment variables:** Never commit secrets; document in `.env.example`

## Environment Variables

`.env` files are gitignored. When environment variables are needed:
- Document them in a `.env.example` file committed to the repo
- Load with `python-dotenv` or similar

## Notes for AI Assistants

- This repo is in early bootstrapping phase — no application code exists yet
- When adding the first source files, establish a clear directory structure and document it here
- Prefer `uv` as the package manager if starting fresh (it is listed in `.gitignore` and is the modern Python standard)
- Update this file whenever significant new conventions, dependencies, or structural decisions are made
- The GitHub remote is `nicodinioh/ai-webapp` — use MCP GitHub tools for all GitHub interactions
