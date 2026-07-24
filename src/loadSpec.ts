import * as fs from 'fs-extra';
import * as https from 'https';
import { isIP } from 'net';
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

/** URL hostname 是否为 IPv4/IPv6（兼容带方括号的 IPv6，如 [::1]） */
export function isIpHostname(hostname: string): boolean {
  const normalized =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  return isIP(normalized) !== 0;
}

/**
 * Node/OpenSSL 对 HTTPS+IP 要求证书含 IP SAN；内网 swagger 常见仅有 DNS SAN。
 * 对 IP 主机跳过 hostname 校验，仍校验 CA 链；insecure 时完全关闭 TLS 校验。
 */
export function createRemoteHttpsAgent(
  input: string,
  insecure?: boolean
): https.Agent | undefined {
  if (!input.startsWith('https://')) return undefined;

  if (insecure) {
    return new https.Agent({ rejectUnauthorized: false });
  }

  let hostname: string;
  try {
    hostname = new URL(input).hostname;
  } catch {
    return undefined;
  }

  if (!isIpHostname(hostname)) return undefined;

  return new https.Agent({
    // 保留 CA 校验，仅跳过 hostname/IP SAN 匹配
    checkServerIdentity: () => undefined
  });
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
  /** 关闭 TLS 证书校验（自签名证书）；HTTPS+IP 默认已跳过 hostname 校验 */
  insecure?: boolean;
}

const DEFAULT_FETCH_TIMEOUT = 30000;

function formatFetchError(input: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const hint = /certificate|TLS|SSL|CERT|UNABLE_TO_VERIFY|SELF_SIGNED/i.test(message)
    ? ' 若为自签名证书，可配置 insecure: true 或使用 CLI --insecure。'
    : '';
  return `Failed to fetch Swagger spec from URL: ${input}. Error: ${error}${hint}`;
}

export async function loadSpec(input: string, options?: LoadSpecOptions): Promise<SwaggerSpec> {
  const timeout = options?.fetchTimeout ?? DEFAULT_FETCH_TIMEOUT;

  if (isRemoteInput(input)) {
    try {
      const httpsAgent = createRemoteHttpsAgent(input, options?.insecure);
      const response = await axios.get(input, {
        timeout,
        headers: SPEC_ACCEPT_HEADERS,
        ...(httpsAgent ? { httpsAgent } : {})
      });

      if (typeof response.data === 'string') {
        return parseSpecContent(response.data, input);
      }

      return assertSwaggerSpec(response.data, input);
    } catch (error) {
      throw new Error(formatFetchError(input, error));
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
