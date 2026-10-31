# Contributing to Bunkialo

## Workflow

1. Fork the repo.
2. Create a branch from `main`.
3. Make focused changes.
4. Run checks locally.
5. Open a pull request.

## Development Setup

```bash
pnpm install
pnpm exec expo start
```

## Android development build

Download the latest APK from the [Bunkialo2 GitHub Releases](https://github.com/Noelithub77/bunkialo2/releases) for device testing. Use the development build for EAS Update previews; Expo Go cannot load updates that use a custom runtime version.

## Quality Checks

```bash
pnpm run typecheck
pnpm test
pnpm run test:lms-scraper
pnpm run test:assignment
pnpm run test:dashboard
pnpm run test:downloads
pnpm run test:resources
```

## Pull Request Rules

- Keep PRs small and focused.
- Include why the change is needed.
- Include test evidence in PR description.
- Do not commit credentials, tokens, or personal data.

## Coding Rules

- TypeScript strict mode.
- No `any`.
- Prefer NativeWind for styling.
- Keep services React-free.
