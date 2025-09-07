import { promises as fs } from 'fs';
import { parse as sfcParse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import {
  compile,
  Node,
  ElementNode,
  NodeTypes,
  SimpleExpressionNode,
  RootNode,
  IfNode,
  ForNode,
} from '@vue/compiler-dom';

export interface ComponentInfo {
  name: string;
  props: Record<string, string | boolean>;
}

export interface AnalysisResult {
  filePath: string;
  scriptType: 'script' | 'script setup' | null;
  styleCount: number;
  components: ComponentInfo[];
  imports: string[];
  definedProps: string[];
  data: string[];
  computed: string[];
  methods: string[];
}

function isComponent(tag: string): boolean {
  return (tag.includes('-') || (tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase()));
}

function getPropValue(exp: SimpleExpressionNode | undefined): string | boolean {
  if (!exp) return true;
  if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    return exp.content;
  }
  return true;
}

function extractProps(node: ElementNode): Record<string, string | boolean> {
  const props: Record<string, string | boolean> = {};
  node.props.forEach(prop => {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      props[prop.name] = prop.value?.content ?? true;
    } else if (prop.type === NodeTypes.DIRECTIVE) {
      let propName = '';
      if (prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
        propName = `:${prop.arg.content}`;
      } else if (prop.name === 'on' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
        propName = `@${prop.arg.content}`;
      } else {
        propName = `v-${prop.name}`
      }
      props[propName] = getPropValue(prop.exp as SimpleExpressionNode);
    }
  });
  return props;
}

function findComponents(node: Node, components: ComponentInfo[]): void {
  if (node.type === NodeTypes.ROOT) {
    (node as RootNode).children.forEach(child => findComponents(child, components));
  } else if (node.type === NodeTypes.ELEMENT) {
    const elementNode = node as ElementNode;
    if (isComponent(elementNode.tag)) {
      components.push({
        name: elementNode.tag,
        props: extractProps(elementNode),
      });
    }
    elementNode.children.forEach(child => findComponents(child, components));
  } else if (node.type === NodeTypes.IF) {
    (node as IfNode).branches.forEach(branch => {
      branch.children.forEach(child => findComponents(child, components));
    });
  } else if (node.type === NodeTypes.FOR) {
    (node as ForNode).children.forEach(child => findComponents(child, components));
  }
}

interface ScriptAnalysis {
  imports: string[];
  definedProps: string[];
  data: string[];
  computed: string[];
  methods: string[];
}

function analyzeScript(scriptContent: string): ScriptAnalysis {
  const imports: string[] = [];
  const definedProps: string[] = [];
  const data: string[] = [];
  const computed: string[] = [];
  const methods: string[] = [];
  const sourceFile = ts.createSourceFile('temp.ts', scriptContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // 1. Extract imports
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }

    // 2. Analyze Composition API (<script setup>)
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && ts.isCallExpression(decl.initializer)) {
          const callExpr = decl.initializer;
          if (ts.isIdentifier(callExpr.expression)) {
            const calleeName = callExpr.expression.text;
            if (calleeName === 'ref' || calleeName === 'reactive') {
              data.push(decl.name.text);
            } else if (calleeName === 'computed') {
              computed.push(decl.name.text);
            }
          }
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      methods.push(node.name.text);
    }

    // 3. Analyze defineProps (both APIs)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineProps') {
      const arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        arg.properties.forEach(prop => {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            definedProps.push(prop.name.text);
          }
        });
      } else if (arg && ts.isArrayLiteralExpression(arg)) {
        arg.elements.forEach(elem => {
          if (ts.isStringLiteral(elem)) {
            definedProps.push(elem.text);
          }
        });
      }
    }

    // 4. Analyze Options API
    if (ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression)) {
      node.expression.properties.forEach(prop => {
        if (!prop.name || !ts.isIdentifier(prop.name)) return;
        const propName = prop.name.text;

        if (propName === 'props' && ts.isPropertyAssignment(prop)) {
          // ... props logic ...
        } else if (propName === 'data' && ts.isMethodDeclaration(prop)) {
          const returnStatement = prop.body?.statements.find(ts.isReturnStatement);
          if (returnStatement?.expression && ts.isObjectLiteralExpression(returnStatement.expression)) {
            returnStatement.expression.properties.forEach(p => {
              if (p.name && ts.isIdentifier(p.name)) data.push(p.name.text);
            });
          }
        } else if ((propName === 'computed' || propName === 'methods') && ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) {
          prop.initializer.properties.forEach(p => {
            if (p.name && ts.isIdentifier(p.name)) {
              if (propName === 'computed') computed.push(p.name.text);
              else methods.push(p.name.text);
            }
          });
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { imports, definedProps, data, computed, methods };
}

export async function analyzeVueFile(filePath: string): Promise<AnalysisResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { descriptor, errors } = sfcParse(content, { filename: filePath });

    if (errors.length) {
      console.error(`Error parsing ${filePath}:`, errors);
      return null;
    }

    let scriptType: AnalysisResult['scriptType'] = null;
    let scriptAnalysis: ScriptAnalysis = { imports: [], definedProps: [], data: [], computed: [], methods: [] };
    const scriptContent = descriptor.script?.content ?? descriptor.scriptSetup?.content;

    if (descriptor.scriptSetup) {
      scriptType = 'script setup';
    } else if (descriptor.script) {
      scriptType = 'script';
    }

    if (scriptContent) {
      scriptAnalysis = analyzeScript(scriptContent);
    }

    const components: ComponentInfo[] = [];
    if (descriptor.template) {
      const ast = compile(descriptor.template.content).ast;
      findComponents(ast, components);
    }

    return {
      filePath,
      scriptType,
      styleCount: descriptor.styles.length,
      components,
      imports: scriptAnalysis.imports,
      definedProps: scriptAnalysis.definedProps,
      data: scriptAnalysis.data,
      computed: scriptAnalysis.computed,
      methods: scriptAnalysis.methods,
    };

  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error(`Error: File not found at ${filePath}`);
    } else {
      console.error(`An unexpected error occurred while analyzing ${filePath}:`, error);
    }
    return null;
  }
}