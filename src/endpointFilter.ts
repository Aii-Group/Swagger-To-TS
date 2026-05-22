import { ApiEndpoint, GeneratorConfig } from './types';

export function matchPathPattern(path: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return regex.test(path);
  }
  return path === pattern || path.startsWith(pattern);
}

export function filterEndpoints(endpoints: ApiEndpoint[], config: GeneratorConfig): ApiEndpoint[] {
  let filtered = endpoints;

  if (config.excludeDeprecated) {
    filtered = filtered.filter(endpoint => !endpoint.deprecated);
  }

  if (config.filterTags && config.filterTags.length > 0) {
    const tags = new Set(config.filterTags);
    filtered = filtered.filter(endpoint =>
      endpoint.tags?.some(tag => tags.has(tag))
    );
  }

  if (config.filterPaths && config.filterPaths.length > 0) {
    filtered = filtered.filter(endpoint =>
      config.filterPaths!.some(pattern => matchPathPattern(endpoint.path, pattern))
    );
  }

  return filtered;
}

export function getResponseWrapperField(config: GeneratorConfig): string | null {
  if (!config.responseWrapper) return null;
  if (config.responseWrapper === true) return 'data';
  return config.responseWrapper.field || 'data';
}

/**
 * 从响应类型中提取 wrapper 字段的内层类型
 */
export function unwrapResponseType(
  type: string,
  wrapperField: string,
  typeDefinitions: Array<{ name: string; properties?: Record<string, { type: string }> }>
): string {
  const inlineField = extractInlineObjectFieldType(type, wrapperField);
  if (inlineField) return inlineField;

  const typeDef = typeDefinitions.find(def => def.name === type);
  if (typeDef?.properties?.[wrapperField]) {
    return typeDef.properties[wrapperField].type;
  }

  return type;
}

function extractInlineObjectFieldType(type: string, field: string): string | null {
  const trimmed = type.trim();
  if (!trimmed.startsWith('{')) return null;

  const body = trimmed.slice(1, -1);
  const segments = splitObjectSegments(body);

  for (const segment of segments) {
    const colonIndex = segment.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = segment.slice(0, colonIndex).trim();
    const key = keyPart.replace(/\?$/, '').trim();
    const normalizedKey = key.replace(/^["']|["']$/g, '');

    if (normalizedKey === field) {
      return segment.slice(colonIndex + 1).trim();
    }
  }

  return null;
}

function splitObjectSegments(body: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' || ch === '(' || ch === '<') depth++;
    else if (ch === '}' || ch === ')' || ch === '>') depth--;
    else if (ch === ';' && depth === 0) {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) segments.push(current.trim());
  return segments;
}

export function sanitizeTagFileName(tag: string): string {
  return createTagModuleIdentifiers(tag, new Set()).fileName;
}

export interface TagModuleIdentifiers {
  fileName: string;
  className: string;
  propertyName: string;
  originalTag: string;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

function slugToPascalCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function slugToCamelCase(slug: string): string {
  const pascal = slugToPascalCase(slug);
  if (!pascal) return 'tagModule';
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function ensureValidIdentifier(name: string, prefix: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, '');
  if (!cleaned || !/^[a-zA-Z_$]/.test(cleaned)) {
    return `${prefix}${cleaned}`;
  }
  return cleaned;
}

/**
 * 将 tag 转为合法 TS 模块标识符。
 * 含中文时保留 ASCII 部分并追加 hash，确保文件名/类名/属性名合法且唯一。
 */
export function createTagModuleIdentifiers(
  tag: string,
  usedSlugs: Set<string>
): TagModuleIdentifiers {
  const normalizedTag = tag.trim() || 'default';
  const asciiParts = normalizedTag.match(/[a-zA-Z0-9]+/g) || [];
  const hasChinese = /[\u4e00-\u9fff]/.test(normalizedTag);
  const tagHash = shortHash(normalizedTag);

  let slug = asciiParts.join('-').toLowerCase();

  if (hasChinese) {
    slug = slug ? `${slug}-${tagHash}` : `tag-${tagHash}`;
  }

  if (!slug) {
    slug = `tag-${tagHash}`;
  }

  let uniqueSlug = slug;
  let counter = 2;
  while (usedSlugs.has(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  usedSlugs.add(uniqueSlug);

  const className = `${ensureValidIdentifier(slugToPascalCase(uniqueSlug), 'Tag')}Api`;
  const propertyName = ensureValidIdentifier(slugToCamelCase(uniqueSlug), 'tag')
    .replace(/^[A-Z]/, char => char.toLowerCase());

  return {
    fileName: uniqueSlug,
    className,
    propertyName,
    originalTag: normalizedTag
  };
}

export function buildTagModuleMap(tags: string[]): Map<string, TagModuleIdentifiers> {
  const usedSlugs = new Set<string>();
  const map = new Map<string, TagModuleIdentifiers>();

  tags.forEach(tag => {
    map.set(tag, createTagModuleIdentifiers(tag, usedSlugs));
  });

  return map;
}
