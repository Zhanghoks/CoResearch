import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts"],
  extends: [...tseslint.configs.recommended],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@xyflow/react",
            message:
              "packages/engine is server-portable. Use `import type` for Node/Edge shapes only.",
            allowTypeImports: true,
          },
        ],
      },
    ],
  },
});
