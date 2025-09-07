import { Command } from 'commander';
import { glob } from 'glob';
import { analyzeVueFile, AnalysisResult, ComponentInfo } from './analyzer';
import { promises as fs } from 'fs';
import path from 'path';
import ejs from 'ejs';

const program = new Command();

program
  .name('vue-analyzer')
  .description('A CLI tool to analyze Vue.js files')
  .version('1.0.0');

function printResultsToConsole(results: AnalysisResult[]) {
  for (const result of results) {
    if (!result) continue;
    console.log(`
--- Analysis for ${result.filePath} ---
`);
    console.log(`  - Script: ${result.scriptType ?? 'none'}`);
    console.log(`  - Styles: ${result.styleCount}`);
    if (result.imports.length > 0) {
      console.log(`  - Imports (${result.imports.length}):`);
      result.imports.forEach(imp => console.log(`    - ${imp}`));
    }
    if (result.definedProps.length > 0) {
      console.log(`  - Defined Props (${result.definedProps.length}):`);
      result.definedProps.forEach(prop => console.log(`    - ${prop}`));
    }
    if (result.data.length > 0) {
      console.log(`  - Data (${result.data.length}):`);
      result.data.forEach(d => console.log(`    - ${d}`));
    }
    if (result.computed.length > 0) {
      console.log(`  - Computed (${result.computed.length}):`);
      result.computed.forEach(c => console.log(`    - ${c}`));
    }
    if (result.methods.length > 0) {
      console.log(`  - Methods (${result.methods.length}):`);
      result.methods.forEach(m => console.log(`    - ${m}`));
    }
    if (result.components.length > 0) {
      console.log('  - Component Usage:');
      result.components.forEach(comp => {
        console.log(`    - Component: ${comp.name}`);
        Object.entries(comp.props).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 50 ? `${value.substring(0, 47)}...` : value;
          console.log(`      - Prop: ${key} = "${displayValue}"`);
        });
      });
    } else {
      console.log('  - No components found in template.');
    }
  }
}

interface FlatComponentInfo {
  filePath: string;
  componentName: string;
  props: Record<string, string | boolean>;
}

function flattenResults(results: AnalysisResult[]): FlatComponentInfo[] {
  const flat: FlatComponentInfo[] = [];
  for (const result of results) {
    if (result.components) {
      for (const component of result.components) {
        flat.push({
          filePath: result.filePath,
          componentName: component.name,
          props: component.props,
        });
      }
    }
  }
  return flat;
}

program
  .command('analyze')
  .description('Analyze Vue files based on specified files or directories')
  .option('-f, --file <paths...>', 'One or more specific files to analyze')
  .option('-d, --dir <paths...>', 'Directories to search for Vue files')
  .option('-o, --output <file>', 'Save analysis report to a file (e.g., report.json, report.html)')
  .option('-t, --report-type <type>', 'Type of HTML report: summary or component', 'summary')
  .action(async (options: { file?: string[], dir?: string[], output?: string, reportType?: string }) => {
    const filesToProcess: { absolutePath: string, displayPath: string }[] = [];

    if (options.file) {
      for (const f of options.file) {
        filesToProcess.push({
          absolutePath: path.resolve(f),
          displayPath: path.basename(f),
        });
      }
    }

    if (options.dir) {
      for (const dir of options.dir) {
        const resolvedDir = path.resolve(dir);
        const foundFiles = await glob('**/*.vue', { cwd: resolvedDir, absolute: true, ignore: 'node_modules/**' });
        for (const absPath of foundFiles) {
          // Avoid adding duplicates if a file in a dir was also specified with --file
          if (!filesToProcess.some(f => f.absolutePath === absPath)) {
            filesToProcess.push({
              absolutePath: absPath,
              displayPath: path.relative(resolvedDir, absPath),
            });
          }
        }
      }
    }

    if (filesToProcess.length === 0) {
      console.log('Please specify at least one file or directory to analyze.');
      program.help();
      return;
    }

    const analysisPromises = filesToProcess.map(file => analyzeVueFile(file.absolutePath));
    const allResults = await Promise.all(analysisPromises);

    const validResults = allResults
      .filter((r): r is AnalysisResult => r !== null)
      .map(result => {
        const originalFile = filesToProcess.find(f => f.absolutePath === result.filePath);
        return { ...result, filePath: originalFile?.displayPath || result.filePath };
      });

    if (options.output) {
      const outputExtension = path.extname(options.output).toLowerCase();

      if (outputExtension === '.html') {
        let templatePath: string;
        let renderData: object;

        if (options.reportType === 'component') {
          templatePath = path.join(__dirname, 'component-report-template.ejs');
          renderData = { flatResults: flattenResults(validResults) };
        } else { // Default to summary report
          templatePath = path.join(__dirname, 'report-template.ejs');
          renderData = { results: validResults };
        }

        const template = await fs.readFile(templatePath, 'utf-8');
        const html = ejs.render(template, renderData);
        await fs.writeFile(options.output, html, 'utf-8');
        console.log(`HTML report saved to ${options.output}`);

      } else { // Default to JSON
        const report = JSON.stringify(validResults, null, 2);
        await fs.writeFile(options.output, report, 'utf-8');
        console.log(`JSON report saved to ${options.output}`);
      }
    } else {
      printResultsToConsole(validResults);
    }
  });

program.parse(process.argv);
