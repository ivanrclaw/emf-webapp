# EMF WebApp

A modern, web-based alternative to the [Eclipse Modeling Framework (EMF)](https://eclipse.dev/modeling/emf/). Design Ecore metamodels visually, validate with OCL, generate code, and export Eclipse-compatible `.ecore` files — all from your browser.

**Live demo:** [emf-webapp.fly.dev](https://emf-webapp.fly.dev)

---

## Features

- **Visual Metamodel Editor** — Drag-and-drop diagram editor (React Flow) for EClasses, EAttributes, EReferences, EEnums, and inheritance
- **Eclipse Interoperability** — Import/export `.ecore` XMI files fully compatible with Eclipse EMF
- **OCL Constraints** — Define and validate Object Constraint Language rules against model instances
- **Code Generation** — Template-based code generation from metamodels (Java, TypeScript, etc.)
- **M1 Model Instances** — Create and manage instances conforming to your metamodels
- **Auto-Layout** — Dagre-based hierarchical layout (top-bottom / left-right) with fit-to-view
- **Dark Mode** — Full dark/light theme support
- **GenModel Export** — Generate `.genmodel` files for Eclipse code generation workflows
- **Project Management** — Organize metamodels, models, and constraints within projects

## Architecture

```
emf-webapp/
├── packages/
│   ├── core/        # Ecore model, XMI serialization, OCL engine (shared)
│   ├── backend/     # NestJS REST API + SQLite persistence
│   └── frontend/    # React 19 + Vite + React Flow diagram editor
├── fly.toml         # Fly.io deployment config
└── Dockerfile       # Production multi-stage build
```

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, React Flow, Monaco Editor |
| Backend | NestJS, TypeORM, SQLite |
| Core | TypeScript (shared serialization + OCL) |
| Deploy | Fly.io (auto-scale to zero, persistent volume) |

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install & Run

```bash
# Clone
git clone https://github.com/ivanrclaw/emf-webapp.git
cd emf-webapp

# Install dependencies
npm install

# Build core (required first)
npm run build -w packages/core

# Development (backend + frontend)
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend API on `http://localhost:3000`.

### Run Tests

```bash
npm run test
```

Currently **184 tests** across core (160) and backend (24).

## Eclipse Interoperability

EMF WebApp produces `.ecore` files that are **directly importable** into Eclipse:

- Correct XMI namespace declarations (`xmi:version="2.0"`, `xmlns:ecore`)
- Proper `eType` references (`#//ClassName`, `ecore:EDataType http://...`)
- `eSuperTypes` for inheritance chains
- Default value omission (matches Eclipse behavior)
- `xmi:id` only on classifiers (EClass, EEnum, EDataType)
- GenModel generation with all genClasses and genEnums

### Import from Eclipse

```bash
curl -X POST https://emf-webapp.fly.dev/api/projects/{pid}/xmi/{mmid}/import \
  -H 'Content-Type: application/json' \
  -d '{"xml": "<your .ecore XML content>"}'
```

### Export to Eclipse

```bash
curl https://emf-webapp.fly.dev/api/projects/{pid}/xmi/{mmid}/ecore
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects` | List/create projects |
| GET/POST | `/api/projects/:pid/metamodels` | List/create metamodels |
| POST | `/api/projects/:pid/xmi/:mmid/import` | Import .ecore XMI |
| GET | `/api/projects/:pid/xmi/:mmid/ecore` | Export .ecore XMI |
| GET | `/api/projects/:pid/xmi/:mmid/genmodel` | Export .genmodel |
| GET/POST | `/api/metamodels/:mmid/constraints` | OCL constraints CRUD |
| POST | `/api/metamodels/:mmid/constraints/validate` | Validate OCL against model |
| GET/POST | `/api/projects/:pid/metamodels/:mmid/models` | M1 model instances CRUD |
| GET/POST | `/api/metamodels/:mmid/templates` | Code generation templates |

## Deployment

Deployed on [Fly.io](https://fly.io) with auto-scaling:

```bash
fly deploy
```

Configuration in `fly.toml` — uses a persistent volume for SQLite data.

## License

MIT

## Author

[Iván Ruiz López](https://github.com/ivanrclaw) — UNEX (Universidad de Extremadura)
