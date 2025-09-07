# vue-analyzer
A CLI tool for analyzing Vue.js source files. It can parse component usage, props, script details, and generate reports in various formats.

## Features

- Analyze single files or entire directories.
- Extracts detailed information from `.vue` files:
  - **Template Analysis**: Detects component usage and their passed props.
  - **Script Analysis**: Parses `import` statements, `props` definitions, `data`, `computed`, and `methods` for both Options and Composition API.
- Generate reports in multiple formats:
  - Console output
  - JSON file
  - Detailed summary HTML report
  - Interactive, filterable component-centric HTML report

## Installation

1. Clone the repository.
2. Install dependencies using pnpm:
   ```bash
   pnpm install
   ```

## Building from Source

To compile the TypeScript source code, run the build command:

```bash
pnpm build
```
This will transpile the `.ts` files into the `dist` directory and copy the necessary report templates.

## Usage

The main command is `analyze`. It uses a set of options to determine which files to analyze and how to format the output.

> **Note:** The following examples use `pnpm start` to run the CLI locally without a global installation.

### Command Syntax

```bash
pnpm start analyze [options]
```

### Options

- `-f, --file <paths...>`: Specify one or more Vue files to analyze.
- `-d, --dir <paths...>`: Specify one or more directories to search for Vue files.
- `-o, --output <file>`: Save the analysis report to a file. The format is determined by the file extension (`.json` or `.html`).
- `-t, --report-type <type>`: Specifies the type of HTML report to generate. Can be `summary` (default) or `component`.

### Examples

**1. Analyze a directory and print to console:**

```bash
pnpm start analyze --dir test-data
```

**2. Analyze a single file and save to a JSON report:**

```bash
pnpm start analyze --file test-data/BrandDetail.vue -o report.json
```

**3. Generate a detailed summary HTML report:**

```bash
pnpm start analyze --dir test-data -o summary-report.html
```
*(Note: `--report-type summary` is the default and can be omitted)*

**4. Generate an interactive, component-centric HTML report:**

This report is ideal for filtering and exploring component usage across multiple files.

```bash
pnpm start analyze --dir test-data -o component-report.html --report-type component
```
