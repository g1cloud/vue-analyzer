#!/usr/bin/env node

import { Command } from 'commander';
import { glob } from 'glob';
import { analyzeVueFile, AnalysisResult } from './analyzer';
import { promises as fs } from 'fs';

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
      result.imports.forEach(imp => {
        console.log(`    - ${imp}`);
      });
    }
    if (result.definedProps.length > 0) {
      console.log(`  - Defined Props (${result.definedProps.length}):`);
      result.definedProps.forEach(prop => {
        console.log(`    - ${prop}`);
      });
    }
    if (result.data.length > 0) {
      console.log(`  - Data (${result.data.length}):`);
      result.data.forEach(d => {
        console.log(`    - ${d}`);
      });
    }
    if (result.computed.length > 0) {
      console.log(`  - Computed (${result.computed.length}):`);
      result.computed.forEach(c => {
        console.log(`    - ${c}`);
      });
    }
    if (result.methods.length > 0) {
      console.log(`  - Methods (${result.methods.length}):`);
      result.methods.forEach(m => {
        console.log(`    - ${m}`);
      });
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

program
  .command('analyze')
  .description('Analyze Vue files based on specified files or directories')
  .option('-f, --file <paths...>', 'One or more specific files to analyze')
  .option('-d, --dir <paths...>', 'Directories to search for Vue files')
  .option('-o, --output <file>', 'Save analysis report to a JSON file')
  .action(async (options: { file?: string[], dir?: string[], output?: string }) => {
    const filesToAnalyze: string[] = [];

    if (options.file) {
      filesToAnalyze.push(...options.file);
    }

    if (options.dir) {
      for (const dir of options.dir) {
        const foundFiles = await glob('**/*.vue', { cwd: dir, absolute: true, ignore: 'node_modules/**' });
        filesToAnalyze.push(...foundFiles);
      }
    }

    if (filesToAnalyze.length === 0) {
      console.log('Please specify at least one file or directory to analyze.');
      program.help();
      return;
    }

    const analysisPromises = filesToAnalyze.map(filePath => analyzeVueFile(filePath));
    const allResults = await Promise.all(analysisPromises);
    const validResults = allResults.filter((r): r is AnalysisResult => r !== null);

    if (options.output) {
      const report = JSON.stringify(validResults, null, 2);
      await fs.writeFile(options.output, report, 'utf-8');
      console.log(`Analysis report saved to ${options.output}`);
    } else {
      printResultsToConsole(validResults);
    }
  });

program.parse(process.argv);