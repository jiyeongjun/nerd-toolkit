module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'import',
    'sonarjs',
    'unicorn',
    'prettier',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:sonarjs/recommended',
    'plugin:unicorn/recommended',
    'prettier', // Must be last to override other configs
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: [
      './packages/*/tsconfig.json'
    ],
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: [
          './packages/*/tsconfig.json'
        ],
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // TypeScript specific rules (Silicon Valley standards)
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error', 
      { prefer: 'type-imports' }
    ],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Import rules (Silicon Valley standard)
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external', 
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-unresolved': 'error',

    // General code quality (Silicon Valley standards)
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',

    // Unicorn rules (adjusted for TypeScript)
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    'unicorn/no-null': 'off', // Allow null in TypeScript
    'unicorn/prefer-module': 'off', // Allow CommonJS in config files

    // SonarJS rules (code quality)
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
  },

  overrides: [
    // Config files (completely disable type-aware rules)
    {
      files: [
        '*.config.js', 
        '*.config.ts', 
        '.eslintrc.js',
        '**/tsup.config.ts',
        '**/vitest.config.ts',
        '**/vite.config.ts'
      ],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Completely disable project for config files
      },
      env: {
        node: true,
      },
      rules: {
        // Reset all type-aware rules
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        
        // Allow config file patterns
        'unicorn/prefer-module': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-commonjs': 'off',
        'unicorn/filename-case': 'off',
        'no-console': 'off',
        'import/order': 'off',
        'import/no-unresolved': 'off',
        
        // Basic TypeScript rules only
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Test files
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'sonarjs/no-duplicate-string': 'off',
        'unicorn/consistent-function-scoping': 'off',
      },
    },
  ],

  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '.tsbuildinfo',
    'coverage/',
  ],
};
