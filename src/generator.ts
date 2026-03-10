import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ApiEndpoint,
  ApiParameter,
  TypeDefinition,
  GeneratorConfig
} from './types';
import { SwaggerParser } from './parser';

export class TypeScriptGenerator {
  private config: GeneratorConfig;
  private parser: SwaggerParser;
  private usedMethodNames: Set<string> = new Set();
  private unknownMethodCounter = 0;

  constructor(config: GeneratorConfig, parser: SwaggerParser) {
    this.config = config;
    this.parser = parser;
  }

  async generate(): Promise<void> {
    await fs.ensureDir(this.config.output);
    await this.generateTypes();

    if (this.config.generateClient !== false) {
      await this.generateApiClient();
    }

    await this.generateIndex();
  }

  private async generateTypes(): Promise<void> {
    const typeDefinitions = this.parser.getTypeDefinitions();
    const content = this.generateTypesContent(typeDefinitions);
    const filePath = path.join(this.config.output, 'types.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private generateTypesContent(typeDefinitions: TypeDefinition[]): string {
    const lines: string[] = [];

    lines.push('// 自动生成的类型定义文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');

    lines.push('export interface ApiResponse<T = any> {');
    lines.push('  data: T;');
    lines.push('  status: number;');
    lines.push('  statusText: string;');
    lines.push('  headers: any;');
    lines.push('}');
    lines.push('');

    lines.push('export interface ApiError {');
    lines.push('  message: string;');
    lines.push('  status?: number;');
    lines.push('  code?: string;');
    lines.push('}');
    lines.push('');

    lines.push('export interface RequestInterceptor {');
    lines.push('  onFulfilled?: (config: any) => any | Promise<any>;');
    lines.push('  onRejected?: (error: any) => any;');
    lines.push('}');
    lines.push('');
    lines.push('export interface ResponseInterceptor {');
    lines.push('  onFulfilled?: (response: any) => any | Promise<any>;');
    lines.push('  onRejected?: (error: any) => any;');
    lines.push('}');
    lines.push('');
    lines.push('export interface InterceptorConfig {');
    lines.push('  request?: RequestInterceptor;');
    lines.push('  response?: ResponseInterceptor;');
    lines.push('}');
    lines.push('');

    typeDefinitions.forEach(typeDef => {
      if (typeDef.description) {
        lines.push(`/** ${typeDef.description} */`);
      }

      const prefix = this.config.typePrefix || '';
      const typeName = `${prefix}${typeDef.name}`;

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
        lines.push(`export type ${typeName} = ${typeDef.aliasType || 'any'};`);
      } else {
        lines.push(`export type ${typeName} = any;`);
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  private async generateApiClient(): Promise<void> {
    const endpoints = this.parser.getApiEndpoints();
    const content = this.generateApiClientContent(endpoints);
    const filePath = path.join(this.config.output, 'api.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private generateApiClientContent(endpoints: ApiEndpoint[]): string {
    const lines: string[] = [];

    lines.push('// 自动生成的 API 客户端文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push('import axios, { AxiosInstance, AxiosRequestConfig } from \'axios\';');
    lines.push('import * as Types from \'./types\';');
    lines.push('');
    lines.push('export interface ApiClientConfig extends AxiosRequestConfig {');
    lines.push('  baseURL?: string;');
    lines.push('  interceptors?: Types.InterceptorConfig;');
    lines.push('}');
    lines.push('');

    const instanceName = this.config.axiosInstance || 'apiClient';
    const baseURL = this.config.baseURL || this.parser.getBaseUrl();

    lines.push(`export class ApiClient {`);
    lines.push(`  private ${instanceName}: AxiosInstance;`);
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
    lines.push('');
    lines.push(`    this.setupInterceptors(interceptors);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  private setupInterceptors(interceptors?: Types.InterceptorConfig) {`);
    lines.push(`    const reqFulfilled = interceptors?.request?.onFulfilled || ((config: any) => config);`);
    lines.push(`    const reqRejected = interceptors?.request?.onRejected || ((error: any) => Promise.reject(error));`);
    lines.push(`    this.${instanceName}.interceptors.request.use(reqFulfilled, reqRejected);`);
    lines.push('');
    lines.push(`    const resFulfilled = interceptors?.response?.onFulfilled || ((response: any) => response.data);`);
    lines.push(`    const resRejected = interceptors?.response?.onRejected || ((error: any) => {`);
    lines.push(`      const apiError: Types.ApiError = {`);
    lines.push(`        message: error.message,`);
    lines.push(`        status: error.response?.status,`);
    lines.push(`        code: error.code,`);
    lines.push(`      };`);
    lines.push(`      return Promise.reject(apiError);`);
    lines.push(`    });`);
    lines.push(`    this.${instanceName}.interceptors.response.use(resFulfilled, resRejected);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  setRequestInterceptor(interceptor: Types.RequestInterceptor) {`);
    lines.push(`    this.${instanceName}.interceptors.request.use(`);
    lines.push(`      interceptor.onFulfilled || ((config: any) => config),`);
    lines.push(`      interceptor.onRejected || ((error: any) => Promise.reject(error))`);
    lines.push(`    );`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  setResponseInterceptor(interceptor: Types.ResponseInterceptor) {`);
    lines.push(`    this.${instanceName}.interceptors.response.use(`);
    lines.push(`      interceptor.onFulfilled || ((response: any) => response),`);
    lines.push(`      interceptor.onRejected || ((error: any) => Promise.reject(error))`);
    lines.push(`    );`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  clearInterceptors() {`);
    lines.push(`    this.${instanceName}.interceptors.request.clear();`);
    lines.push(`    this.${instanceName}.interceptors.response.clear();`);
    lines.push(`    this.setupInterceptors();`);
    lines.push(`  }`);
    lines.push('');

    const groupedEndpoints = this.groupEndpointsByTag(endpoints);

    Object.entries(groupedEndpoints).forEach(([tag, tagEndpoints]) => {
      if (tag && tag !== 'default') {
        lines.push(`  // ── ${tag} ──`);
      }

      tagEndpoints.forEach(endpoint => {
        const methodContent = this.generateEndpointMethod(endpoint);
        lines.push(...methodContent);
      });

      lines.push('');
    });

    lines.push('}');
    lines.push('');
    lines.push(`export const apiClient = new ApiClient();`);
    lines.push('');
    lines.push('export default apiClient;');

    return lines.join('\n');
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

  private generateEndpointMethod(endpoint: ApiEndpoint): string[] {
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
    const returnType = successResponse ? this.addTypesPrefix(successResponse.type) : 'any';

    // JSDoc 注释
    const hasDoc = endpoint.summary || endpoint.description;
    if (hasDoc) {
      lines.push(`  /**`);
      if (endpoint.summary) {
        lines.push(`   * ${endpoint.summary}`);
      }
      if (endpoint.description && endpoint.description !== endpoint.summary) {
        lines.push(`   * ${endpoint.description}`);
      }
      lines.push(`   * @route ${endpoint.method} ${endpoint.path}`);
      lines.push(`   */`);
    }

    const paramsStr = params.join(', ');
    lines.push(`  ${methodName} = async (${paramsStr}): Promise<${returnType}> => {`);

    // 构建 URL
    let url = endpoint.path;
    pathParams.forEach(param => {
      url = url.replace(`{${param.name}}`, `\${${param.name}}`);
    });

    const hasPathParams = pathParams.length > 0;
    const urlStr = hasPathParams ? `\`${url}\`` : `'${url}'`;
    const axisInstance = `this.${this.config.axiosInstance || 'apiClient'}`;
    const method = endpoint.method.toLowerCase();

    // 构建 config 对象
    const configParts: string[] = [];

    if (bodyParam?.isFormData) {
      configParts.push(`headers: { 'Content-Type': 'multipart/form-data' }`);
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
      Object.entries(bodyParam.formDataFields).forEach(([fieldName, fieldInfo]) => {
        if (fieldInfo.required) {
          lines.push(`    formData.append('${fieldName}', ${fieldName} as any);`);
        } else {
          lines.push(`    if (${fieldName} !== undefined) {`);
          if (fieldInfo.type.includes('[]')) {
            lines.push(`      (${fieldName} as any[]).forEach(item => formData.append('${fieldName}', item));`);
          } else {
            lines.push(`      formData.append('${fieldName}', ${fieldName} as any);`);
          }
          lines.push(`    }`);
        }
      });
    }

    // 根据 HTTP 方法生成正确的 axios 调用
    if (['get', 'delete', 'head', 'options'].includes(method)) {
      lines.push(`    return ${axisInstance}.${method}(${urlStr}, ${configStr});`);
    } else {
      // POST/PUT/PATCH 等带 body 的方法
      if (bodyParam) {
        const bodyArg = bodyParam.isFormData ? 'formData' : 'data';
        lines.push(`    return ${axisInstance}.${method}(${urlStr}, ${bodyArg}, ${configStr});`);
      } else {
        lines.push(`    return ${axisInstance}.${method}(${urlStr}, undefined, ${configStr});`);
      }
    }

    lines.push(`  };`);
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
      console.warn(`[Swagger 规范警告] operationId "${name}" 包含中文字符，不符合规范，已重命名为 "${result}"`);
    } else {
      const cleaned = name
        .replace(/[^a-zA-Z0-9_]/g, '')
        .replace(/^[0-9]+/, '');

      if (!cleaned) {
        this.unknownMethodCounter++;
        result = `method${this.unknownMethodCounter}`;
        console.warn(`[Swagger 规范警告] operationId "${name}" 清理后为空，已重命名为 "${result}"`);
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
    if (!type) return 'any';

    const basicTypes = new Set([
      'string', 'number', 'boolean', 'any', 'void', 'object',
      'unknown', 'never', 'null', 'undefined', 'File', 'FormData',
      'Blob', 'ArrayBuffer'
    ]);
    const builtinGenericTypes = new Set([
      'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude',
      'Extract', 'NonNullable', 'ReturnType', 'InstanceType', 'Parameters',
      'ConstructorParameters', 'Awaited', 'Array', 'Promise', 'Map', 'Set'
    ]);

    // 联合类型：按 | 拆分处理（注意避免拆开泛型内部的 |）
    if (this.hasTopLevelOperator(type, '|')) {
      return type.split(/\s*\|\s*/)
        .map(t => this.addTypesPrefix(t.trim()))
        .join(' | ');
    }

    // 交叉类型：按 & 拆分处理
    if (this.hasTopLevelOperator(type, '&')) {
      return type.split(/\s*&\s*/)
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

      const processedName = builtinGenericTypes.has(genericName) || basicTypes.has(genericName)
        ? genericName
        : `Types.${genericName}`;

      // 用智能分割处理嵌套泛型（避免在 < > 内部切分）
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
    if (basicTypes.has(type)) {
      return type;
    }

    // 内置泛型基础名称直接返回
    if (builtinGenericTypes.has(type)) {
      return type;
    }

    // 自定义类型加前缀
    return `Types.${type}`;
  }

  /**
   * 智能分割泛型参数列表，正确处理嵌套泛型
   * 例如 "string, Record<string, any>" → ["string", "Record<string, any>"]
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
    }

    const content = lines.join('\n');
    const filePath = path.join(this.config.output, 'index.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }
}
