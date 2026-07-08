import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { parse as parseYaml } from 'yaml';
import { SwaggerSpec } from './types';
import { isSwaggerSpec } from './typeGuards';

const SPEC_ACCEPT_HEADERS = {
  Accept: 'application/json, application/yaml, text/yaml'
};

export function isRemoteInput(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

function isYamlExtension(filePath?: string): boolean {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml';
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function assertSwaggerSpec(value: unknown, source?: string): SwaggerSpec {
  if (!isSwaggerSpec(value)) {
    throw new Error(`Not a valid Swagger/OpenAPI file${source ? `: ${source}` : ''}`);
  }
  return value;
}

export function parseSpecContent(content: string, filePath?: string): SwaggerSpec {
  if (isYamlExtension(filePath) || (!looksLikeJson(content) && content.trim().length > 0)) {
    try {
      return assertSwaggerSpec(parseYaml(content), filePath);
    } catch (yamlError) {
      if (isYamlExtension(filePath)) {
        throw new Error(`Failed to parse YAML spec${filePath ? `: ${filePath}` : ''}. ${yamlError}`);
      }
    }
  }

  try {
    return assertSwaggerSpec(JSON.parse(content), filePath);
  } catch (jsonError) {
    try {
      return assertSwaggerSpec(parseYaml(content), filePath);
    } catch {
      throw new Error(`Failed to parse spec as JSON or YAML. ${jsonError}`);
    }
  }
}

export interface LoadSpecOptions {
  fetchTimeout?: number;
}

const DEFAULT_FETCH_TIMEOUT = 30000;

export async function loadSpec(input: string, options?: LoadSpecOptions): Promise<SwaggerSpec> {
  const timeout = options?.fetchTimeout ?? DEFAULT_FETCH_TIMEOUT;

  if (isRemoteInput(input)) {
    try {
      const response = await axios.get(input, {
        timeout,
        headers: SPEC_ACCEPT_HEADERS
      });

      if (typeof response.data === 'string') {
        return parseSpecContent(response.data, input);
      }

      return assertSwaggerSpec(response.data, input);
    } catch (error) {
      throw new Error(`Failed to fetch Swagger spec from URL: ${input}. Error: ${error}`);
    }
  }

  const filePath = path.resolve(input);
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return parseSpecContent(content, filePath);
}

export function validateSpecStructure(spec: SwaggerSpec): void {
  if (!spec.swagger && !spec.openapi) {
    throw new Error('Not a valid Swagger/OpenAPI file: missing swagger or openapi field');
  }

  if (!spec.info) {
    throw new Error('Missing required field: info');
  }

  if (!spec.paths) {
    throw new Error('Missing required field: paths');
  }
}
