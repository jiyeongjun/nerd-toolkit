#!/bin/bash

echo "🚀 Installing updated dependencies..."
pnpm install

echo "🧹 Cleaning existing build artifacts..."
pnpm clean

echo "✅ Running TypeScript compilation check..."
pnpm build

echo "🔍 Running ESLint check..."
pnpm lint

echo "✨ All done! Your project is now configured with Silicon Valley standards:"
echo "  ✓ Strict TypeScript configuration with project references"
echo "  ✓ Comprehensive ESLint rules (TypeScript + Import + SonarJS + Unicorn)"
echo "  ✓ Prettier integration"
echo "  ✓ Optimized monorepo structure"
echo ""
echo "Next steps:"
echo "  1. Run 'pnpm install' to install new dependencies"
echo "  2. Run 'pnpm lint:fix' to auto-fix any linting issues"
echo "  3. Run 'pnpm build' to verify everything compiles correctly"
