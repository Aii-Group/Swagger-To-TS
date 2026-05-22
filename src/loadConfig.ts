import * as fs from 'fs-extra';
import * as path from 'path';
import { createJiti } from 'jiti';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { GeneratorConfig } from './types';

type ConfigFileExport =
  | GeneratorConfig
  | GeneratorConfig[]
  | { configs: GeneratorConfig[] };

const JS_LIKE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts']);

export function expandConfigPaths(paths: string[]): string[] {
  return paths.flatMap(item =>
    item.split(',').map(part => part.trim()).filter(Boolean)
  );
}

export function validateConfig(input: unknown, source: string): GeneratorConfig {
  if (!input || typeof input !== 'object') {
    throw new Error(`Invalid config at ${source}: expected an object`);
  }

  const config = input as GeneratorConfig;
  if (!config.input) {
    throw new Error(`Missing "input" in ${source}`);
  }
  if (!config.output) {
    throw new Error(`Missing "output" in ${source}`);
  }

  return config;
}

export function normalizeConfigExport(input: unknown, source: string): GeneratorConfig[] {
  if (Array.isArray(input)) {
    return input.map((item, index) => validateConfig(item, `${source}[${index}]`));
  }

  if (input && typeof input === 'object' && 'configs' in input) {
    const configs = (input as { configs: unknown }).configs;
    if (!Array.isArray(configs)) {
      throw new Error(`Invalid config file ${source}: "configs" must be an array`);
    }
    return configs.map((item, index) => validateConfig(item, `${source}.configs[${index}]`));
  }

  return [validateConfig(input, source)];
}

function isJsLikeExtension(ext: string): boolean {
  return JS_LIKE_EXTENSIONS.has(ext);
}

function unwrapModuleExport(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const mod = raw as Record<string, unknown>;
  const keys = Object.keys(mod).filter(key => key !== '__esModule');

  if (keys.length === 1 && keys[0] === 'default' && 'default' in mod) {
    return mod.default;
  }

  return raw;
}

async function loadModuleConfig(configPath: string): Promise<unknown> {
  const jiti = createJiti(__filename, { interopDefault: true });
  return unwrapModuleExport(jiti(configPath));
}

async function loadStructuredConfig(configPath: string, ext: string): Promise<unknown> {
  const content = await fs.readFile(configPath, 'utf-8');

  if (ext === '.json') {
    return JSON.parse(content);
  }

  if (ext === '.yaml' || ext === '.yml') {
    return parseYaml(content);
  }

  try {
    return JSON.parse(content);
  } catch {
    return parseYaml(content);
  }
}

export async function loadConfigFile(configPath: string): Promise<GeneratorConfig[]> {
  const resolved = path.resolve(configPath);
  if (!(await fs.pathExists(resolved))) {
    throw new Error(`Config file not found: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  const raw = isJsLikeExtension(ext)
    ? await loadModuleConfig(resolved)
    : await loadStructuredConfig(resolved, ext);

  return normalizeConfigExport(raw, resolved);
}

export async function loadConfigFiles(configPaths: string[]): Promise<GeneratorConfig[]> {
  const expanded = expandConfigPaths(configPaths);
  if (expanded.length === 0) {
    throw new Error('No config files provided');
  }

  const configs: GeneratorConfig[] = [];
  for (const configPath of expanded) {
    configs.push(...await loadConfigFile(configPath));
  }
  return configs;
}

export function getDefaultConfigTemplate(): GeneratorConfig {
  return {
    input: './swagger.json',
    output: './src/api',
    baseURL: 'https://api.example.com',
    typePrefix: '',
    axiosInstance: 'apiClient',
    generateClient: true,
    responseWrapper: { field: 'data' },
    excludeDeprecated: false,
    splitByTag: false,
    silentWarnings: true
  };
}

export function renderConfigTemplate(
  format: 'json' | 'yaml' | 'js' | 'ts',
  multiple = false
): string {
  const single = getDefaultConfigTemplate();
  const payload: ConfigFileExport = multiple ? [single, { ...single, output: './src/api/other' }] : single;

  switch (format) {
    case 'json':
      return `${JSON.stringify(payload, null, 2)}\n`;
    case 'yaml':
      return stringifyYaml(payload);
    case 'js':
      if (multiple) {
        return `module.exports = ${JSON.stringify(payload, null, 2)};\n`;
      }
      return `module.exports = ${JSON.stringify(single, null, 2)};\n`;
    case 'ts':
      if (multiple) {
        return `import type { GeneratorConfig } from 'swagger-to-ts-axios';\n\nconst configs: GeneratorConfig[] = ${JSON.stringify(payload, null, 2)};\n\nexport default configs;\n`;
      }
      return `import type { GeneratorConfig } from 'swagger-to-ts-axios';\n\nconst config: GeneratorConfig = ${JSON.stringify(single, null, 2)};\n\nexport default config;\n`;
    default:
      return `${JSON.stringify(payload, null, 2)}\n`;
  }
}

export function detectConfigFormat(filePath: string): 'json' | 'yaml' | 'js' | 'ts' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') return 'ts';
  if (ext === '.js' || ext === '.cjs' || ext === '.mjs') return 'js';
  return 'json';
}
