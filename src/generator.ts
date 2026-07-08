import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ApiEndpoint,
  ApiParameter,
  TypeDefinition,
  GeneratorConfig
} from './types';
import { SwaggerParser } from './parser';
import {
  filterEndpoints,
  getResponseWrapperField,
  buildTagModuleMap,
  TagModuleIdentifiers,
  unwrapResponseType
} from './endpointFilter';
import { FALLBACK_SCALAR_TYPE } from './typeUtils';

const BASIC_TYPES = new Set([
  'string', 'number', 'boolean', 'void',
  'unknown', 'never', 'null', 'undefined', 'File', 'FormData',
  'Blob', 'ArrayBuffer'
]);

const BUILTIN_GENERIC_TYPES = new Set([
  'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude',
  'Extract', 'NonNullable', 'ReturnType', 'InstanceType', 'Parameters',
  'ConstructorParameters', 'Awaited', 'Array', 'Promise', 'Map', 'Set'
]);

export class TypeScriptGenerator {
  private config: GeneratorConfig;
  private parser: SwaggerParser;
  private usedMethodNames: Set<string> = new Set();
  private unknownMethodCounter = 0;
  private cachedTagModuleMap: Map<string, TagModuleIdentifiers> | null = null;

  constructor(config: GeneratorConfig, parser: SwaggerParser) {
    this.config = config;
    this.parser = parser;
  }

  async generate(): Promise<void> {
    await fs.ensureDir(this.config.output);
    await this.generateTypes();

    const modulesDir = path.join(this.config.output, 'modules');

    if (this.config.generateClient !== false) {
      if (this.config.splitByTag) {
        await this.generateSplitApiClient();
      } else {
        if (await fs.pathExists(modulesDir)) {
          await fs.remove(modulesDir);
        }
        await this.generateApiClient();
      }
    } else if (await fs.pathExists(modulesDir)) {
      await fs.remove(modulesDir);
    }

    await this.generateIndex();
  }

  private getFilteredEndpoints(): ApiEndpoint[] {
    return filterEndpoints(this.parser.getApiEndpoints(), this.config);
  }

  private async generateTypes(): Promise<void> {
    const typeDefinitions = this.parser.getTypeDefinitions();
    const content = this.generateTypesContent(typeDefinitions);
    const filePath = path.join(this.config.output, 'types.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private getExportedTypeName(name: string): string {
    const prefix = this.config.typePrefix || '';
    return `${prefix}${name}`;
  }

  private generateTypesContent(typeDefinitions: TypeDefinition[]): string {
    const lines: string[] = [];

    lines.push('// 自动生成的类型定义文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push("import type { AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';");
    lines.push('');

    lines.push('export interface ApiResponse<T = unknown> {');
    lines.push('  data: T;');
    lines.push('  status: number;');
    lines.push('  statusText: string;');
    lines.push('  headers: Record<string, unknown>;');
    lines.push('}');
    lines.push('');

    lines.push('export interface ApiError {');
    lines.push('  message: string;');
    lines.push('  status?: number;');
    lines.push('  code?: string;');
    lines.push('}');
    lines.push('');

    lines.push('export interface RequestInterceptor {');
    lines.push('  onFulfilled?: (');
    lines.push('    config: InternalAxiosRequestConfig');
    lines.push('  ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;');
    lines.push('  onRejected?: (error: unknown) => unknown;');
    lines.push('}');
    lines.push('');
    lines.push('export interface ResponseInterceptor {');
    lines.push('  onFulfilled?: (response: AxiosResponse<unknown>) => unknown | Promise<unknown>;');
    lines.push('  onRejected?: (error: unknown) => unknown;');
    lines.push('}');
    lines.push('');
    lines.push('export interface RawResponseInterceptor {');
    lines.push('  onFulfilled?: (');
    lines.push('    response: AxiosResponse<unknown>');
    lines.push('  ) => AxiosResponse<unknown> | Promise<AxiosResponse<unknown>>;');
    lines.push('  onRejected?: (error: unknown) => unknown;');
    lines.push('}');
    lines.push('');
    lines.push('export interface InterceptorConfig {');
    lines.push('  request?: RequestInterceptor;');
    lines.push('  response?: ResponseInterceptor;');
    lines.push('}');
    lines.push('');
    lines.push('/** 响应拦截器解包后的 HTTP 客户端类型 */');
    lines.push('export interface TypedHttpClient {');
    lines.push('  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  options<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;');
    lines.push('}');
    lines.push('');

    typeDefinitions.forEach(typeDef => {
      if (typeDef.description) {
        lines.push(`/** ${typeDef.description} */`);
      }

      const typeName = this.getExportedTypeName(typeDef.name);

      // types.ts 中所有类型在同一文件，直接使用裸类型名（不加 Types. 前缀）
      if (typeDef.type === 'interface' && typeDef.properties) {
        lines.push(`export interface ${typeName} {`);
        Object.entries(typeDef.properties).forEach(([propName, prop]) => {
          if (prop.description) {
            lines.push(`  /** ${prop.description} */`);
          }
          const optional = prop.required ? '' : '?';
          lines.push(`  ${propName}${optional}: ${prop.type};`);
        });
        lines.push('}');
      } else if (typeDef.type === 'enum' && typeDef.enumValues && typeDef.enumValues.length > 0) {
        lines.push(`export type ${typeName} = ${typeDef.enumValues.join(' | ')};`);
      } else if (typeDef.type === 'type') {
        lines.push(`export type ${typeName} = ${typeDef.aliasType || FALLBACK_SCALAR_TYPE};`);
      } else {
        lines.push(`export type ${typeName} = ${FALLBACK_SCALAR_TYPE};`);
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  private async generateApiClient(): Promise<void> {
    const endpoints = this.getFilteredEndpoints();
    const content = this.generateApiClientContent(endpoints);
    const filePath = path.join(this.config.output, 'api.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private async generateSplitApiClient(): Promise<void> {
    const endpoints = this.getFilteredEndpoints();
    const grouped = this.groupEndpointsByTag(endpoints);
    const modulesDir = path.join(this.config.output, 'modules');
    await fs.ensureDir(modulesDir);

    const moduleExports: TagModuleIdentifiers[] = [];
    const tagModuleMap = buildTagModuleMap(Object.keys(grouped));
    this.cachedTagModuleMap = tagModuleMap;

    for (const [tag, tagEndpoints] of Object.entries(grouped)) {
      this.usedMethodNames = new Set();
      this.unknownMethodCounter = 0;

      const identifiers = tagModuleMap.get(tag)!;
      const moduleContent = this.generateTagModuleContent(
        identifiers.className,
        tagEndpoints,
        tag
      );
      await fs.writeFile(
        path.join(modulesDir, `${identifiers.fileName}.ts`),
        moduleContent,
        'utf-8'
      );
      moduleExports.push(identifiers);
    }

    const apiContent = this.generateSplitApiClientContent(moduleExports);
    await fs.writeFile(path.join(this.config.output, 'api.ts'), apiContent, 'utf-8');
  }

  private generateApiClientContent(endpoints: ApiEndpoint[]): string {
    const lines: string[] = [];

    lines.push('// 自动生成的 API 客户端文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push('import axios from \'axios\';');
    lines.push('import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from \'axios\';');
    lines.push('import * as Types from \'./types\';');
    lines.push('');
    lines.push(...this.generateHttpClientHelpers());
    lines.push('');
    lines.push('export interface ApiClientConfig extends AxiosRequestConfig {');
    lines.push('  baseURL?: string;');
    lines.push('  interceptors?: Types.InterceptorConfig;');
    lines.push('}');
    lines.push('');

    const instanceName = this.config.axiosInstance || 'apiClient';
    const baseURL = this.config.baseURL || this.parser.getBaseUrl();
    const defaultInterceptors = this.generateDefaultInterceptorsBlock();

    if (defaultInterceptors.length > 0) {
      lines.push(...defaultInterceptors);
      lines.push('');
    }

    lines.push(`export class ApiClient {`);
    lines.push(`  private ${instanceName}: AxiosInstance;`);
    lines.push('  private http: Types.TypedHttpClient;');
    lines.push('');
    lines.push(`  constructor(config: ApiClientConfig = {}) {`);
    lines.push(`    const { baseURL = '${baseURL}', interceptors, ...axiosConfig } = config;`);
    lines.push('');
    lines.push(`    this.${instanceName} = axios.create({`);
    lines.push(`      baseURL,`);
    lines.push(`      timeout: 10000,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`      ...axiosConfig,`);
    lines.push(`    });`);
    lines.push(`    this.http = createTypedHttpClient(this.${instanceName});`);
    lines.push('');
    lines.push(`    this.setupInterceptors(interceptors${defaultInterceptors.length > 0 ? ' || defaultInterceptors' : ''});`);
    lines.push(`  }`);
    lines.push('');
    lines.push(...this.generateInterceptorMethods(instanceName));

    const groupedEndpoints = this.groupEndpointsByTag(endpoints);
    const axiosRef = 'this.http';

    Object.entries(groupedEndpoints).forEach(([tag, tagEndpoints]) => {
      if (tag && tag !== 'default') {
        lines.push(`  // ── ${tag} ──`);
      }

      tagEndpoints.forEach(endpoint => {
        lines.push(...this.generateEndpointMethod(endpoint, axiosRef));
      });

      lines.push('');
    });

    lines.push('}');
    lines.push('');
    lines.push(`export const apiClient = new ApiClient(${defaultInterceptors.length > 0 ? '{ interceptors: defaultInterceptors }' : ''});`);
    lines.push('');
    lines.push('export default apiClient;');

    return lines.join('\n');
  }

  private generateSplitApiClientContent(modules: TagModuleIdentifiers[]): string {
    const lines: string[] = [];

    lines.push('// 自动生成的 API 客户端文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push('import axios from \'axios\';');
    lines.push('import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from \'axios\';');
    lines.push('import * as Types from \'./types\';');

    modules.forEach(module => {
      lines.push(`import { ${module.className} } from './modules/${module.fileName}';`);
    });

    lines.push('');
    lines.push(...this.generateHttpClientHelpers());
    lines.push('');
    lines.push('export interface ApiClientConfig extends AxiosRequestConfig {');
    lines.push('  baseURL?: string;');
    lines.push('  interceptors?: Types.InterceptorConfig;');
    lines.push('}');
    lines.push('');

    const instanceName = this.config.axiosInstance || 'apiClient';
    const baseURL = this.config.baseURL || this.parser.getBaseUrl();
    const defaultInterceptors = this.generateDefaultInterceptorsBlock();

    if (defaultInterceptors.length > 0) {
      lines.push(...defaultInterceptors);
      lines.push('');
    }

    lines.push('export class ApiClient {');
    lines.push(`  private ${instanceName}: AxiosInstance;`);
    lines.push('  private http: Types.TypedHttpClient;');
    lines.push('');

    modules.forEach(module => {
      if (module.originalTag !== module.fileName) {
        lines.push(`  /** Tag: ${module.originalTag} */`);
      }
      lines.push(`  readonly ${module.propertyName}: ${module.className};`);
    });

    lines.push('');
    lines.push('  constructor(config: ApiClientConfig = {}) {');
    lines.push(`    const { baseURL = '${baseURL}', interceptors, ...axiosConfig } = config;`);
    lines.push('');
    lines.push(`    this.${instanceName} = axios.create({`);
    lines.push('      baseURL,');
    lines.push('      timeout: 10000,');
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push('      ...axiosConfig,');
    lines.push('    });');
    lines.push(`    this.http = createTypedHttpClient(this.${instanceName});`);
    lines.push('');
    lines.push(`    this.setupInterceptors(interceptors${defaultInterceptors.length > 0 ? ' || defaultInterceptors' : ''});`);
    lines.push('');

    modules.forEach(module => {
      lines.push(`    this.${module.propertyName} = new ${module.className}(this.http);`);
    });

    lines.push('  }');
    lines.push('');
    lines.push(...this.generateInterceptorMethods(instanceName));
    lines.push('}');
    lines.push('');
    lines.push(`export const apiClient = new ApiClient(${defaultInterceptors.length > 0 ? '{ interceptors: defaultInterceptors }' : ''});`);
    lines.push('');
    lines.push('export default apiClient;');

    return lines.join('\n');
  }

  private generateTagModuleContent(className: string, endpoints: ApiEndpoint[], tag: string): string {
    const lines: string[] = [];

    lines.push('// 自动生成的 API 模块文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push('import type { AxiosRequestConfig } from \'axios\';');
    lines.push('import * as Types from \'../types\';');
    lines.push('');
    lines.push(`export class ${className} {`);
    lines.push('  constructor(private client: Types.TypedHttpClient) {}');
    lines.push('');

    if (tag && tag !== 'default') {
      lines.push(`  // ── ${tag} ──`);
    }

    endpoints.forEach(endpoint => {
      lines.push(...this.generateEndpointMethod(endpoint, 'this.client'));
    });

    lines.push('}');
    return lines.join('\n');
  }

  private generateInterceptorMethods(instanceName: string): string[] {
    const wrapperField = getResponseWrapperField(this.config);
    const defaultResponseTransform = wrapperField
      ? `(response: AxiosResponse<unknown>) => { const body = response.data; return (body as Record<string, unknown>)?.${wrapperField} ?? body; }`
      : '(response: AxiosResponse<unknown>) => response.data';

    return [
      '  private setupInterceptors(interceptors?: Types.InterceptorConfig) {',
      '    const reqFulfilled = interceptors?.request?.onFulfilled ?? ((config: InternalAxiosRequestConfig) => config);',
      '    const reqRejected = interceptors?.request?.onRejected ?? ((error: unknown) => Promise.reject(error));',
      `    this.${instanceName}.interceptors.request.use(reqFulfilled, reqRejected);`,
      '',
      `    const resFulfilled = interceptors?.response?.onFulfilled ?? (${defaultResponseTransform});`,
      '    const resRejected = interceptors?.response?.onRejected ?? ((error: unknown) => Promise.reject(toApiError(error)));',
      `    this.${instanceName}.interceptors.response.use(`,
      '      resFulfilled as Parameters<AxiosInstance[\'interceptors\'][\'response\'][\'use\']>[0],',
      '      resRejected',
      '    );',
      '  }',
      '',
      '  setRequestInterceptor(interceptor: Types.RequestInterceptor) {',
      `    this.${instanceName}.interceptors.request.use(`,
      '      interceptor.onFulfilled ?? ((config: InternalAxiosRequestConfig) => config),',
      '      interceptor.onRejected ?? ((error: unknown) => Promise.reject(error))',
      '    );',
      '  }',
      '',
      '  setResponseInterceptor(interceptor: Types.RawResponseInterceptor) {',
      `    this.${instanceName}.interceptors.response.use(`,
      '      interceptor.onFulfilled ?? ((response: AxiosResponse<unknown>) => response),',
      '      interceptor.onRejected ?? ((error: unknown) => Promise.reject(error))',
      '    );',
      '  }',
      '',
      '  clearInterceptors() {',
      `    this.${instanceName}.interceptors.request.clear();`,
      `    this.${instanceName}.interceptors.response.clear();`,
      '    this.setupInterceptors();',
      '  }',
      ''
    ];
  }

  private generateHttpClientHelpers(): string[] {
    return [
      'function createTypedHttpClient(client: AxiosInstance): Types.TypedHttpClient {',
      '  return client as unknown as Types.TypedHttpClient;',
      '}',
      '',
      'function toApiError(error: unknown): Types.ApiError {',
      '  const message = error instanceof Error ? error.message : String(error);',
      '  let status: number | undefined;',
      '  let code: string | undefined;',
      '  if (typeof error === \'object\' && error !== null) {',
      '    const err = error as { response?: { status?: unknown }; code?: unknown };',
      '    if (typeof err.response?.status === \'number\') {',
      '      status = err.response.status;',
      '    }',
      '    if (typeof err.code === \'string\') {',
      '      code = err.code;',
      '    }',
      '  }',
      '  return { message, status, code };',
      '}',
    ];
  }

  private normalizeScalarType(type: string): string {
    if (type === 'any') return FALLBACK_SCALAR_TYPE;
    if (type === 'object') return 'Record<string, unknown>';
    return type;
  }

  private generateDefaultInterceptorsBlock(): string[] {
    const interceptors = this.config.interceptors;
    if (!interceptors) return [];

    const lines = ['const defaultInterceptors: Types.InterceptorConfig = {'];

    if (interceptors.request?.onFulfilled || interceptors.request?.onRejected) {
      lines.push('  request: {');
      if (interceptors.request.onFulfilled) {
        lines.push(`    onFulfilled: ${interceptors.request.onFulfilled},`);
      }
      if (interceptors.request.onRejected) {
        lines.push(`    onRejected: ${interceptors.request.onRejected},`);
      }
      lines.push('  },');
    }

    if (interceptors.response?.onFulfilled || interceptors.response?.onRejected) {
      lines.push('  response: {');
      if (interceptors.response.onFulfilled) {
        lines.push(`    onFulfilled: ${interceptors.response.onFulfilled},`);
      }
      if (interceptors.response.onRejected) {
        lines.push(`    onRejected: ${interceptors.response.onRejected},`);
      }
      lines.push('  },');
    }

    lines.push('};');
    return lines;
  }

  private groupEndpointsByTag(endpoints: ApiEndpoint[]): Record<string, ApiEndpoint[]> {
    const grouped: Record<string, ApiEndpoint[]> = {};

    endpoints.forEach(endpoint => {
      const tag = endpoint.tags?.[0] || 'default';
      if (!grouped[tag]) {
        grouped[tag] = [];
      }
      grouped[tag].push(endpoint);
    });

    return grouped;
  }

  private generateEndpointMethod(endpoint: ApiEndpoint, axiosRef: string): string[] {
    const lines: string[] = [];
    const methodName = this.generateMethodName(endpoint);

    // 只处理 path、query、body 参数（header 已在 parser 中警告并跳过）
    const pathParams = endpoint.parameters.filter(p => p.in === 'path');
    const queryParams = endpoint.parameters.filter(p => p.in === 'query');
    const bodyParam = endpoint.requestBody;

    const requiredParams: string[] = [];
    const optionalParams: string[] = [];

    // path 参数（规范要求必须是 required）
    pathParams.forEach(param => {
      const paramType = this.addTypesPrefix(param.type);
      if (param.required) {
        requiredParams.push(`${param.name}: ${paramType}`);
      } else {
        optionalParams.push(`${param.name}?: ${paramType}`);
      }
    });

    // 请求体参数
    if (bodyParam) {
      if (bodyParam.isFormData && bodyParam.formDataFields) {
        Object.entries(bodyParam.formDataFields).forEach(([fieldName, fieldInfo]) => {
          const paramType = fieldInfo.type === 'File' ? 'File' : this.addTypesPrefix(fieldInfo.type);
          if (fieldInfo.required) {
            requiredParams.push(`${fieldName}: ${paramType}`);
          } else {
            optionalParams.push(`${fieldName}?: ${paramType}`);
          }
        });
      } else {
        const bodyType = this.addTypesPrefix(bodyParam.type);
        if (bodyParam.required) {
          requiredParams.push(`data: ${bodyType}`);
        } else {
          optionalParams.push(`data?: ${bodyType}`);
        }
      }
    }

    // query 参数
    const requiredQueryParams = queryParams.filter(p => p.required);
    const optionalQueryParams = queryParams.filter(p => !p.required);

    requiredQueryParams.forEach(param => {
      requiredParams.push(`${param.name}: ${this.addTypesPrefix(param.type)}`);
    });

    if (optionalQueryParams.length > 0) {
      const queryType = this.generateQueryParamsType(optionalQueryParams);
      optionalParams.push(`params?: ${queryType}`);
    }

    optionalParams.push('config?: AxiosRequestConfig');

    const params = [...requiredParams, ...optionalParams];

    const successResponse = endpoint.responses.find(r => r.statusCode.startsWith('2'));
    let returnType = successResponse ? this.addTypesPrefix(successResponse.type) : FALLBACK_SCALAR_TYPE;

    const wrapperField = getResponseWrapperField(this.config);
    if (wrapperField && successResponse) {
      returnType = this.addTypesPrefix(
        unwrapResponseType(successResponse.type, wrapperField, this.parser.getTypeDefinitions())
      );
    }

    const hasDoc = endpoint.summary || endpoint.description || endpoint.deprecated;
    if (hasDoc) {
      lines.push(`  /**`);
      if (endpoint.summary) {
        lines.push(`   * ${endpoint.summary}`);
      }
      if (endpoint.description && endpoint.description !== endpoint.summary) {
        lines.push(`   * ${endpoint.description}`);
      }
      if (endpoint.deprecated) {
        lines.push(`   * @deprecated`);
      }
      lines.push(`   * @route ${endpoint.method} ${endpoint.path}`);
      lines.push(`   */`);
    }

    const paramsStr = params.join(', ');
    lines.push(`  async ${methodName}(${paramsStr}): Promise<${returnType}> {`);

    // 构建 URL
    let url = endpoint.path;
    pathParams.forEach(param => {
      url = url.replace(`{${param.name}}`, `\${${param.name}}`);
    });

    const hasPathParams = pathParams.length > 0;
    const urlStr = hasPathParams ? `\`${url}\`` : `'${url}'`;
    const method = endpoint.method.toLowerCase();
    const methodsWithoutBodyArg = ['get', 'delete', 'head', 'options'];
    const bodyInConfig = Boolean(bodyParam && methodsWithoutBodyArg.includes(method));
    const bodyArg = bodyParam?.isFormData ? 'formData' : 'data';

    // 构建 config 对象
    const configParts: string[] = [];

    if (bodyParam?.isFormData) {
      configParts.push(`headers: { 'Content-Type': 'multipart/form-data' }`);
    }

    if (bodyInConfig) {
      configParts.push(bodyArg === 'data' ? 'data' : `data: ${bodyArg}`);
    }

    if (queryParams.length > 0) {
      if (requiredQueryParams.length > 0 && optionalQueryParams.length > 0) {
        const reqKeys = requiredQueryParams.map(p => p.name).join(', ');
        configParts.push(`params: { ${reqKeys}, ...params }`);
      } else if (requiredQueryParams.length > 0) {
        const reqKeys = requiredQueryParams.map(p => p.name).join(', ');
        configParts.push(`params: { ${reqKeys} }`);
      } else {
        configParts.push('params');
      }
    }

    const configStr = configParts.length > 0
      ? `{ ${configParts.join(', ')}, ...config }`
      : 'config';

    // 生成 FormData 构建代码
    if (bodyParam?.isFormData && bodyParam.formDataFields) {
      lines.push(`    const formData = new FormData();`);
      const formDataValueExpr = (expr: string) =>
        `${expr} instanceof Blob ? ${expr} : String(${expr})`;
      Object.entries(bodyParam.formDataFields).forEach(([fieldName, fieldInfo]) => {
        const isArray = fieldInfo.type.endsWith('[]');
        if (fieldInfo.required) {
          if (isArray) {
            lines.push(`    ${fieldName}.forEach(item => formData.append('${fieldName}', item instanceof Blob ? item : String(item)));`);
          } else {
            lines.push(`    formData.append('${fieldName}', ${formDataValueExpr(fieldName)});`);
          }
        } else {
          lines.push(`    if (${fieldName} !== undefined) {`);
          if (isArray) {
            lines.push(`      ${fieldName}.forEach(item => formData.append('${fieldName}', item instanceof Blob ? item : String(item)));`);
          } else {
            lines.push(`      formData.append('${fieldName}', ${formDataValueExpr(fieldName)});`);
          }
          lines.push(`    }`);
        }
      });
    }

    // 根据 HTTP 方法生成正确的 axios 调用
    if (methodsWithoutBodyArg.includes(method)) {
      lines.push(`    return ${axiosRef}.${method}<${returnType}>(${urlStr}, ${configStr});`);
    } else if (bodyParam) {
      lines.push(`    return ${axiosRef}.${method}<${returnType}>(${urlStr}, ${bodyArg}, ${configStr});`);
    } else {
      lines.push(`    return ${axiosRef}.${method}<${returnType}>(${urlStr}, undefined, ${configStr});`);
    }

    lines.push(`  }`);
    lines.push('');

    return lines;
  }

  private generateMethodName(endpoint: ApiEndpoint): string {
    if (endpoint.operationId) {
      const sanitized = this.sanitizeMethodName(endpoint.operationId);
      return this.toCamelCase(sanitized);
    }

    // 无 operationId 时根据路径和方法生成
    const pathParts = endpoint.path
      .split('/')
      .filter(part => part && !part.startsWith('{'));
    const lastPart = pathParts[pathParts.length - 1] || 'api';
    const method = endpoint.method.toLowerCase();
    const candidate = this.toCamelCase(`${method}_${lastPart}`);

    // 确保唯一性
    if (!this.usedMethodNames.has(candidate)) {
      this.usedMethodNames.add(candidate);
      return candidate;
    }

    let counter = 2;
    while (this.usedMethodNames.has(`${candidate}${counter}`)) {
      counter++;
    }
    const unique = `${candidate}${counter}`;
    this.usedMethodNames.add(unique);
    return unique;
  }

  /**
   * 清理方法名，使其符合 TypeScript 标识符规范
   * 遇到不规范的名称时记录警告，不做静默的随机重命名
   */
  private warn(message: string): void {
    if (!this.config.silentWarnings) {
      console.warn(message);
    }
  }

  private sanitizeMethodName(name: string): string {
    if (!name) return 'unknownMethod';

    const hasChinese = /[\u4e00-\u9fff]/.test(name);
    const nonChinesePart = name
      .replace(/[\u4e00-\u9fff]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/^[0-9]+/, '');

    let result: string;

    if (hasChinese) {
      if (nonChinesePart) {
        result = nonChinesePart;
      } else {
        this.unknownMethodCounter++;
        result = `method${this.unknownMethodCounter}`;
      }
      this.warn(`[Swagger 规范警告] operationId "${name}" 包含中文字符，不符合规范，已重命名为 "${result}"`);
    } else {
      const cleaned = name
        .replace(/[^a-zA-Z0-9_]/g, '')
        .replace(/^[0-9]+/, '');

      if (!cleaned) {
        this.unknownMethodCounter++;
        result = `method${this.unknownMethodCounter}`;
        this.warn(`[Swagger 规范警告] operationId "${name}" 清理后为空，已重命名为 "${result}"`);
      } else {
        result = cleaned;
      }
    }

    // 确保唯一性
    if (this.usedMethodNames.has(result)) {
      let counter = 2;
      const base = result;
      while (this.usedMethodNames.has(`${base}${counter}`)) {
        counter++;
      }
      result = `${base}${counter}`;
    }

    this.usedMethodNames.add(result);
    return result;
  }

  private generateQueryParamsType(queryParams: ApiParameter[]): string {
    const props = queryParams.map(param => {
      const optional = param.required ? '' : '?';
      const type = this.addTypesPrefix(param.type);
      return `${param.name}${optional}: ${type}`;
    });
    return `{ ${props.join('; ')} }`;
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase());
  }

  /**
   * 为自定义类型添加 Types. 前缀
   * 支持联合类型（|）、交叉类型（&）、数组、泛型
   */
  private addTypesPrefix(type: string): string {
    if (!type) return FALLBACK_SCALAR_TYPE;

    type = this.normalizeScalarType(type.trim());

    // 联合类型：深度感知分割
    if (this.hasTopLevelOperator(type, '|')) {
      return this.splitTopLevel(type, '|')
        .map(t => this.addTypesPrefix(t.trim()))
        .join(' | ');
    }

    // 交叉类型：深度感知分割
    if (this.hasTopLevelOperator(type, '&')) {
      return this.splitTopLevel(type, '&')
        .map(t => this.addTypesPrefix(t.trim()))
        .join(' & ');
    }

    // 带括号的类型（如 (A | B)[]）
    if (type.startsWith('(') && type.includes(')')) {
      const closeParen = type.lastIndexOf(')');
      const inner = type.slice(1, closeParen);
      const suffix = type.slice(closeParen + 1);
      return `(${this.addTypesPrefix(inner)})${suffix}`;
    }

    // 数组类型
    if (type.endsWith('[]')) {
      const baseType = type.slice(0, -2);
      return `${this.addTypesPrefix(baseType)}[]`;
    }

    // 内联对象类型 { ... }
    if (type.startsWith('{') && type.endsWith('}')) {
      return type;
    }

    // 泛型类型 Generic<T>
    if (type.includes('<')) {
      const angleBracket = type.indexOf('<');
      const genericName = type.slice(0, angleBracket);
      const innerPart = type.slice(angleBracket + 1, type.lastIndexOf('>'));

      const processedName = BUILTIN_GENERIC_TYPES.has(genericName) || BASIC_TYPES.has(genericName)
        ? genericName
        : `Types.${this.getExportedTypeName(genericName)}`;

      const processedInner = this.splitGenericArgs(innerPart)
        .map(t => this.addTypesPrefix(t.trim()))
        .join(', ');

      return `${processedName}<${processedInner}>`;
    }

    // 字符串字面量类型（如 'value1' | 'value2'）
    if (type.startsWith("'") || type.startsWith('"')) {
      return type;
    }

    // 数字字面量类型
    if (/^-?\d/.test(type)) {
      return type;
    }

    // 基础类型直接返回
    if (BASIC_TYPES.has(type)) {
      return type;
    }

    // 内置泛型基础名称直接返回
    if (BUILTIN_GENERIC_TYPES.has(type)) {
      return type;
    }

    // 自定义类型加 Types. 前缀与 typePrefix
    return `Types.${this.getExportedTypeName(type)}`;
  }

  /**
   * 深度感知分割：按顶层操作符（| 或 &）切分，不切开嵌套括号内的同名操作符
   */
  private splitTopLevel(type: string, operator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    const sep = ` ${operator} `;

    for (let i = 0; i < type.length; i++) {
      const ch = type[i];
      if (ch === '<' || ch === '(' || ch === '{') {
        depth++;
        current += ch;
      } else if (ch === '>' || ch === ')' || ch === '}') {
        depth--;
        current += ch;
      } else if (depth === 0 && type.slice(i, i + sep.length) === sep) {
        parts.push(current.trim());
        current = '';
        i += sep.length - 1;
      } else {
        current += ch;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * 智能分割泛型参数列表，正确处理嵌套泛型
   * 例如 "string, Record<string, unknown>" → ["string", "Record<string, unknown>"]
   */
  private splitGenericArgs(args: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < args.length; i++) {
      const ch = args[i];
      if (ch === '<' || ch === '(' || ch === '{') {
        depth++;
        current += ch;
      } else if (ch === '>' || ch === ')' || ch === '}') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * 检查字符串顶层（非泛型括号内）是否含有指定操作符
   */
  private hasTopLevelOperator(type: string, operator: string): boolean {
    let depth = 0;
    for (let i = 0; i < type.length; i++) {
      const ch = type[i];
      if (ch === '<' || ch === '(' || ch === '{') depth++;
      else if (ch === '>' || ch === ')' || ch === '}') depth--;
      else if (depth === 0 && type.slice(i).startsWith(` ${operator} `)) {
        return true;
      }
    }
    return false;
  }

  private async generateIndex(): Promise<void> {
    const lines: string[] = [
      '// 自动生成的入口文件',
      '// 请勿手动修改此文件',
      '',
      "export * from './types';",
    ];

    if (this.config.generateClient !== false) {
      lines.push("export * from './api';");

      if (this.config.splitByTag && this.cachedTagModuleMap) {
        this.cachedTagModuleMap.forEach(identifiers => {
          lines.push(`export * from './modules/${identifiers.fileName}';`);
        });
      }
    }

    const content = lines.join('\n');
    const filePath = path.join(this.config.output, 'index.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }
}
