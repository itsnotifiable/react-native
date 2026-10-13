---
name: typescript-npm-package
description: >-
  Develop and publish this TypeScript npm library: compiler flags, source
  style, package exports, peers, and the typecheck, lint, test, and build
  scripts. Use when editing TypeScript, package.json, tsconfig, ESLint,
  Vitest, or the npm publish layout of @notifiable/react-native.
---

# TypeScript npm package

This repo is one publishable library, `@notifiable/react-native`. Source lives in `src/`. `npm run build` emits declarations and JavaScript to `lib/`. `lib/` is gitignored and rebuilt before publish.

## Compiler

`tsconfig.json` typechecks and does not emit. `tsconfig.build.json` extends it, sets `noEmit` false, `rootDir` `src`, `outDir` `lib`, and excludes `*.test.ts` and `*.test.tsx`.

Keep these flags:

- `target` and `lib`: `ES2022`
- `module`: `ESNext`, `moduleResolution`: `bundler`
- `jsx`: `react-native`
- `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `verbatimModuleSyntax` and `isolatedModules`
- `declaration`, `declarationMap`, and `sourceMap` on
- `types`: `[]` so `@types/*` are not pulled in globally

`exactOptionalPropertyTypes` is on. Omit an optional field instead of setting it to `undefined`. See `copyConfig` in `src/client/create-client.ts`.

## Source style

- ESM. `package.json` has `"type": "module"`.
- Import types with `import type` or inline `type` specifiers. ESLint `consistent-type-imports` uses `inline-type-imports`.
- No `any`. Unused args, vars, and caught errors start with `_`.
- Public fields and config properties are `readonly`. Hide implementation fields with `#`.
- Prettier: semicolons, double quotes, trailing commas (`trailingComma: "all"`).
- Tests sit next to source as `src/**/*.test.ts` and run in Vitest's `node` environment. Do not put tests under a separate folder.

## npm layout

```json
"main": "./lib/index.js",
"types": "./lib/index.d.ts",
"react-native": "./src/index.ts",
"files": ["src", "lib", "ios", "notifiable-react-native.podspec"],
"exports": {
  ".": {
    "types": "./lib/index.d.ts",
    "react-native": "./src/index.ts",
    "default": "./lib/index.js"
  }
}
```

Metro reads `react-native` and compiles `src/` itself. Node and TypeScript read `lib/`. Publish both. `sideEffects` stays `false`.

There is one export, `.`. Do not add deep export paths. Apps import `@notifiable/react-native` only.

`react` and `react-native` are `peerDependencies`, and also `devDependencies` so local typecheck and tests resolve. Other tooling (`typescript`, `eslint`, `vitest`, `prettier`) is dev-only. Add a runtime `dependency` only when published code imports it.

`prepublishOnly` runs `npm run build`. Do not commit `lib/`.

## Checks

From the package root, before finishing a code change:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`typecheck` is `tsc --noEmit`. `lint` is ESLint flat config with `typescript-eslint` strict type-checked rules. `build` must succeed with tests excluded, because that is what npm publishes.
