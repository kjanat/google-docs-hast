# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run build` - Build TypeScript to dist/ with ESM format and type declarations
- `npm run lint` - Run ESLint with TypeScript, Prettier, and JSDoc plugins
- `npm run format` - Auto-fix linting issues
- `npm test` - Run Vitest tests with snapshots
- `npm run docs` - Generate TypeDoc documentation

## Architecture Overview

This is a TypeScript ES module library that converts Google Docs JSON to HTML Abstract Syntax Tree (HAST) format.

### Core Flow
1. **Input**: Google Docs API JSON document structure
2. **Processing**: Transform through element-specific handlers (paragraphs, lists, tables, etc.)
3. **Output**: HAST-compatible HTML AST using `hastscript`

### Key Components

**Main Entry**: `src/index.ts` exports `{ hast, toHast, HastOptions }`

**Core Transformers**:
- `src/hast/index.ts` - Main transformation orchestrator
- `src/hast/paragraph/` - Paragraph, textRun, inlineObject, person, richLink processing
- `src/hast/lists.ts` - Complex nested list handling with proper nesting
- `src/hast/table/` - Table structure conversion
- `src/hast/common/` - Shared style utilities (CSS generation from Google Docs styling)

**Post-Processing Pipeline**:
- `src/hast/postProcessing/prettyHeaderIds.ts` - Header ID slugification
- `src/hast/postProcessing/removeStyles.ts` - Optional style removal

### Key Dependencies
- `hastscript` - HTML AST creation (`h()` function)
- `@googleapis/docs` - Google Docs API type definitions
- `github-slugger` - Header ID generation

### Testing Strategy
- Uses Vitest with snapshot testing
- Fixture-based tests using real Google Docs JSON
- Test files are in `__tests__/` directories alongside source

### Style Handling
The library generates CSS from Google Docs styling by default. Use `removeStyles: true` in HastOptions to disable style generation.

### Common Development Patterns
- Element processing follows visitor pattern with type-specific handlers
- Heavy use of TypeScript with Google Docs API types for type safety
- Modular design with clear separation of concerns
- Post-processing pipeline allows extensible transformations