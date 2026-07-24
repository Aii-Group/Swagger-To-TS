import { GeneratorConfig } from './types';
import type { SwaggerSpec } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSwaggerSpec(value: unknown): value is SwaggerSpec {
  if (!isRecord(value)) return false;
  if (!isRecord(value.info)) return false;
  if (typeof value.info.title !== 'string' || typeof value.info.version !== 'string') {
    return false;
  }
  if (!isRecord(value.paths)) return false;
  if (!value.swagger && !value.openapi) return false;
  return true;
}

function readStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readBooleanField(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArrayField(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    return undefined;
  }
  return value;
}

function readResponseWrapper(
  value: unknown
): GeneratorConfig['responseWrapper'] | undefined {
  if (value === true) return true;
  if (!isRecord(value)) return undefined;
  const field = readStringField(value, 'field');
  return field ? { field } : {};
}

function readInterceptorStrings(
  value: unknown
): GeneratorConfig['interceptors'] | undefined {
  if (!isRecord(value)) return undefined;

  const request = isRecord(value.request) ? value.request : undefined;
  const response = isRecord(value.response) ? value.response : undefined;

  if (!request && !response) return undefined;

  return {
    request: request
      ? {
          onFulfilled: readStringField(request, 'onFulfilled'),
          onRejected: readStringField(request, 'onRejected')
        }
      : undefined,
    response: response
      ? {
          onFulfilled: readStringField(response, 'onFulfilled'),
          onRejected: readStringField(response, 'onRejected')
        }
      : undefined
  };
}

export function parseGeneratorConfig(input: unknown, source: string): GeneratorConfig {
  if (!isRecord(input)) {
    throw new Error(`Invalid config at ${source}: expected an object`);
  }

  const configInput = input.input;
  const configOutput = input.output;
  if (typeof configInput !== 'string' || !configInput) {
    throw new Error(`Missing or invalid "input" in ${source}`);
  }
  if (typeof configOutput !== 'string' || !configOutput) {
    throw new Error(`Missing or invalid "output" in ${source}`);
  }

  const config: GeneratorConfig = {
    input: configInput,
    output: configOutput
  };

  const baseURL = readStringField(input, 'baseURL');
  if (baseURL !== undefined) config.baseURL = baseURL;

  const axiosInstance = readStringField(input, 'axiosInstance');
  if (axiosInstance !== undefined) config.axiosInstance = axiosInstance;

  const typePrefix = readStringField(input, 'typePrefix');
  if (typePrefix !== undefined) config.typePrefix = typePrefix;

  const generateClient = readBooleanField(input, 'generateClient');
  if (generateClient !== undefined) config.generateClient = generateClient;

  const excludeDeprecated = readBooleanField(input, 'excludeDeprecated');
  if (excludeDeprecated !== undefined) config.excludeDeprecated = excludeDeprecated;

  const splitByTag = readBooleanField(input, 'splitByTag');
  if (splitByTag !== undefined) config.splitByTag = splitByTag;

  const silentWarnings = readBooleanField(input, 'silentWarnings');
  if (silentWarnings !== undefined) config.silentWarnings = silentWarnings;

  const fetchTimeout = input.fetchTimeout;
  if (fetchTimeout !== undefined) {
    if (typeof fetchTimeout !== 'number' || Number.isNaN(fetchTimeout)) {
      throw new Error(`Invalid "fetchTimeout" in ${source}: expected a number`);
    }
    config.fetchTimeout = fetchTimeout;
  }

  const insecure = readBooleanField(input, 'insecure');
  if (insecure !== undefined) config.insecure = insecure;

  const filterTags = readStringArrayField(input, 'filterTags');
  if (filterTags !== undefined) config.filterTags = filterTags;

  const filterPaths = readStringArrayField(input, 'filterPaths');
  if (filterPaths !== undefined) config.filterPaths = filterPaths;

  const responseWrapper = readResponseWrapper(input.responseWrapper);
  if (responseWrapper !== undefined) config.responseWrapper = responseWrapper;

  const interceptors = readInterceptorStrings(input.interceptors);
  if (interceptors !== undefined) config.interceptors = interceptors;

  return config;
}
