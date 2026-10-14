import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const selfImport = {
  group: ["@notifiable/react-native", "@notifiable/react-native/**"],
  message: "Import from relative files inside the package.",
};

const layerImportRestrictions = {
  domain: [
    "../client/**",
    "../transport/**",
    "../platform/**",
    "../react/**",
    "../internal/**",
    "../index.ts",
  ],
  transport: [
    "../client/**",
    "../platform/**",
    "../react/**",
    "../internal/**",
    "../index.ts",
  ],
  platform: [
    "../client/**",
    "../transport/**",
    "../react/**",
    "../internal/**",
    "../index.ts",
  ],
  internal: [
    "../client/**",
    "../transport/**",
    "../platform/**",
    "../react/**",
    "../index.ts",
  ],
  client: ["../react/**", "../index.ts"],
  react: ["../transport/**", "../platform/**", "../internal/**", "../index.ts"],
};

export default tseslint.config(
  {
    ignores: [
      "lib/**",
      "node_modules/**",
      "coverage/**",
      "example/**",
      "test/**",
      "scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [selfImport],
        },
      ],
    },
  },
  ...Object.entries(layerImportRestrictions).map(([layer, groups]) => ({
    files: [`src/${layer}/**/*.ts`, `src/${layer}/**/*.tsx`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            selfImport,
            ...groups.map((group) => ({
              group: [group],
              message: `${layer} cannot import ${group}.`,
            })),
          ],
        },
      ],
    },
  })),
  {
    files: ["src/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            selfImport,
            {
              group: ["./transport/**", "./platform/**", "./internal/**"],
              message:
                "The public entry may import client, react, and domain only.",
            },
          ],
        },
      ],
    },
  },
);
