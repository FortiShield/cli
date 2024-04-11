`workspace.json`:

```json
"frontend": {
    "root": "packages/frontend",
    "targets": {
        "build": {
            "executor": "buildscale:run-script",
            "options": {
                "script": "build-my-project"
            }
        }
    }
}
```

```bash
buildscale run frontend:build
```

The `build` target is going to run `npm run build-my-project` (or `yarn build-my-project`) in the `packages/frontend` directory.

#### Caching Artifacts

By default, Buildscale is going to cache `dist/packages/frontend`, `packages/frontend/dist`, `packages/frontend/build`, `packages/frontend/public`. If your npm script writes files to other places, you can override the list of cached outputs as follows:

```json
"frontend": {
    "root": "packages/frontend",
    "targets": {
        "build": {
            "executor": "buildscale:run-script",
            "outputs": ["{projectRoot}/dist", "{projectRoot}/docs"],
            "options": {
                "script": "build-my-project"
            }
        }
    }
}
```
