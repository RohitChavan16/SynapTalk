# Development Workflow

This section documents how to work on SynapTalk, test features, and contribute in a team-friendly way.

## Local development

1. Start the API server (server folder):

```powershell
cd server
npm install
npm run dev
```

2. Start the client (client folder):

```powershell
cd client
npm install
npm run dev
```

## Branching & PRs

- Use feature branches named `feature/<short-desc>`.
- Open a PR with a clear description, screenshots, and a short testing checklist.

## Testing & linting

- Add unit tests for critical controller logic and key utilities.
