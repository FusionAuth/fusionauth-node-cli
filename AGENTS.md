# FusionAuth CLI - Agent Guidelines

## Build Commands
- Build: `npm run build` (compiles TypeScript to `./dist/`)
- No lint command configured
- No test framework - tests not implemented

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2016, Module: NodeNext (ES modules)
- Strict mode enabled
- Output directory: `./dist/`, Source root: `./src/`

### Imports & Dependencies
- Use `node:fs` for Node.js built-ins (e.g., `import * as fs from 'node:fs'`)
- Regular imports for packages (e.g., `import chalk from 'chalk'`)
- File extensions required in imports (`.js` for compiled output, but `.ts` in source)

### Naming Conventions
- Commands: kebab-case (e.g., `email-create`, `theme-upload`)
- Variables/Functions: camelCase (e.g., `emailTemplateId`, `reportError`)
- Files: kebab-case with `.ts` extension

### Error Handling
- Use `chalk` for colored console output (red for errors, green for success)
- Custom error reporting via `utils.reportError()` and `utils.errorAndExit()`
- Check response types with `isClientResponse()` and `isErrors()` utilities

### Code Structure
- Command definitions use Commander.js with fluent API
- JSDoc comments for function documentation
- Async/await for asynchronous operations
- Template literals for string interpolation