# Hirekal Core

Open-source monorepo for [Hirekal](https://github.com/hirekal) — a modern hiring and applicant tracking platform.

## Structure

```
core/
├── apps/
│   ├── api-app/        # NestJS REST API (backend)
│   └── console-app/    # React + Vite recruiter dashboard (frontend)
├── libs/               # Shared packages (types, utils, UI)
├── scripts/            # Dev & setup scripts
└── .github/            # CI workflows
```

### Naming convention

| App | Folder | Purpose |
|-----|--------|---------|
| **API** | `apps/api-app` | NestJS backend — auth, jobs, candidates, webhooks |
| **Console** | `apps/console-app` | React SPA — recruiter/admin dashboard |

Future apps can follow the same `[purpose]-app` pattern (e.g. `careers-app` for the public job board).

## Requirements

- **Node.js 24** (see `.nvmrc`)

```bash
nvm install
nvm use
```

## Quick start

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

Or manually:

```bash
npm install
npm run dev:api       # http://localhost:3000
npm run dev:console   # http://localhost:5173
```

Run both at once:

```bash
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start NestJS API in watch mode |
| `npm run dev:console` | Start Vite dev server |
| `npm run dev` | Start API and console in parallel |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run tests in all workspaces |

## Contributing

1. Fork the repo and create a branch from `main`
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
3. Open a pull request

## Deployment

See [deploy.md](./deploy.md) for Docker Compose commands, image tags, migrations, and environment setup.

## License

[MIT](LICENSE.md)
