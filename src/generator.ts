import * as fs from 'fs-extra';
import * as path from 'path';
import {
  ApiEndpoint,
  TypeDefinition,
  GeneratorConfig
} from './types';
import { SwaggerParser } from './parser';

export class TypeScriptGenerator {
  private config: GeneratorConfig;
  private parser: SwaggerParser;

  constructor(config: GeneratorConfig, parser: SwaggerParser) {
    this.config = config;
    this.parser = parser;
  }

  async generate(): Promise<void> {
    await fs.ensureDir(this.config.output);

    // 生成类型定义
    await this.generateTypes();

    // 生成 API 客户端
    if (this.config.generateClient !== false) {
      await this.generateApiClient();
    }

    // 生成入口文件
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

    // 生成基础响应类型
    lines.push('export interface ApiResponse<T = any> {');
    lines.push('  data: T;');
    lines.push('  status: number;');
    lines.push('  statusText: string;');
    lines.push('  headers: any;');
    lines.push('}');
    lines.push('');

    // 生成错误类型
    lines.push('export interface ApiError {');
    lines.push('  message: string;');
    lines.push('  status?: number;');
    lines.push('  code?: string;');
    lines.push('}');
    lines.push('');

    // 生成拦截器类型
    lines.push('// 拦截器类型定义');
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

    // 生成模型类型
    typeDefinitions.forEach(typeDef => {
      if (typeDef.description) {
        lines.push(`// ${typeDef.description}`);
      }
      
      const prefix = this.config.typePrefix || '';
      const typeName = `${prefix}${typeDef.name}`;
      
      if (typeDef.type === 'interface' && typeDef.properties) {
        lines.push(`export interface ${typeName} {`);
        
        Object.entries(typeDef.properties).forEach(([propName, prop]) => {
          if (prop.description) {
            lines.push(`  // ${prop.description}`);
          }
          const optional = prop.required ? '' : '?';
          lines.push(`  ${propName}${optional}: ${prop.type};`);
        });
        
        lines.push('}');
      } else if (typeDef.type === 'enum') {
        // 处理枚举类型
        lines.push(`export type ${typeName} = string;`);
      } else {
        // 处理类型别名
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
    lines.push('import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from \'axios\';');
    lines.push('import * as Types from \'./types\';');
    lines.push('');
    lines.push('// 拦截器配置接口');
    lines.push('export interface ApiClientConfig extends AxiosRequestConfig {');
    lines.push('  baseURL?: string;');
    lines.push('  interceptors?: Types.InterceptorConfig;');
    lines.push('}');
    lines.push('');

    // 生成 API 客户端类
    const instanceName = this.config.axiosInstance || 'apiClient';
    const baseURL = this.config.baseURL || this.parser.getBaseUrl();
    
    lines.push(`export class ApiClient {`);
    lines.push(`  private ${instanceName}: AxiosInstance;`);
    lines.push('');
    lines.push(`  constructor(config: ApiClientConfig = {}) {`);
    lines.push(`    const { baseURL = '${baseURL}', interceptors, ...axiosConfig } = config;`);
    lines.push(``);
    lines.push(`    this.${instanceName} = axios.create({`);
    lines.push(`      baseURL,`);
    lines.push(`      timeout: 10000,`);
    lines.push(`      headers: {`);
    lines.push(`        'Content-Type': 'application/json',`);
    lines.push(`      },`);
    lines.push(`      ...axiosConfig,`);
    lines.push(`    });`);
    lines.push(``);
    lines.push(`    this.setupInterceptors(interceptors);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  private setupInterceptors(interceptors?: Types.InterceptorConfig) {`);
    lines.push(`    // 请求拦截器`);
    lines.push(`    const requestOnFulfilled = interceptors?.request?.onFulfilled || ((config) => config);`);
    lines.push(`    const requestOnRejected = interceptors?.request?.onRejected || ((error) => Promise.reject(error));`);
    lines.push(`    this.${instanceName}.interceptors.request.use(requestOnFulfilled, requestOnRejected);`);
    lines.push('');
    lines.push(`    // 响应拦截器`);
    lines.push(`    const responseOnFulfilled = interceptors?.response?.onFulfilled || ((response) => response.data);`);
    lines.push(`    const responseOnRejected = interceptors?.response?.onRejected || ((error) => {`);
    lines.push(`      const apiError: Types.ApiError = {`);
    lines.push(`        message: error.message,`);
    lines.push(`        status: error.response?.status,`);
    lines.push(`        code: error.code,`);
    lines.push(`      };`);
    lines.push(`      return Promise.reject(apiError);`);
    lines.push(`    });`);
    lines.push(`    this.${instanceName}.interceptors.response.use(responseOnFulfilled, responseOnRejected);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  // 动态设置拦截器的方法`);
    lines.push(`  setRequestInterceptor(interceptor: Types.RequestInterceptor) {`);
    lines.push(`    this.${instanceName}.interceptors.request.use(`);
    lines.push(`      interceptor.onFulfilled || ((config) => config),`);
    lines.push(`      interceptor.onRejected || ((error) => Promise.reject(error))`);
    lines.push(`    );`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  setResponseInterceptor(interceptor: Types.ResponseInterceptor) {`);
    lines.push(`    this.${instanceName}.interceptors.response.use(`);
    lines.push(`      interceptor.onFulfilled || ((response) => response),`);
    lines.push(`      interceptor.onRejected || ((error) => Promise.reject(error))`);
    lines.push(`    );`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  // 清除所有拦截器`);
    lines.push(`  clearInterceptors() {`);
    lines.push(`    this.${instanceName}.interceptors.request.clear();`);
    lines.push(`    this.${instanceName}.interceptors.response.clear();`);
    lines.push(`    // 重新设置默认拦截器`);
    lines.push(`    this.setupInterceptors();`);
    lines.push(`  }`);
    lines.push('');
    // 按标签分组生成方法
    const groupedEndpoints = this.groupEndpointsByTag(endpoints);
    
    Object.entries(groupedEndpoints).forEach(([tag, tagEndpoints]) => {
      if (tag && tag !== 'default') {
        lines.push(`  // ${tag} 相关接口`);
      }
      
      tagEndpoints.forEach(endpoint => {
        const methodContent = this.generateEndpointMethod(endpoint);
        lines.push(...methodContent);
      });
      
      if (tag && tag !== 'default') {
        lines.push('');
      }
    });

    lines.push('}');
    lines.push('');
    lines.push('// 默认导出实例');
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
    const pathParams = endpoint.parameters.filter(p => p.in === 'path');
    const queryParams = endpoint.parameters.filter(p => p.in === 'query');
    const bodyParam = endpoint.requestBody;
    
    // 生成方法签名 - 按照必选参数在前，可选参数在后的顺序
    const requiredParams: string[] = [];
    const optionalParams: string[] = [];
    
    // 路径参数
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
      const bodyType = this.addTypesPrefix(bodyParam.type);
      if (bodyParam.required) {
        requiredParams.push(`data: ${bodyType}`);
      } else {
        optionalParams.push(`data?: ${bodyType}`);
      }
    }
    
    // 查询参数 - 分别处理必选和可选的查询参数
    const requiredQueryParams = queryParams.filter(p => p.required);
    const optionalQueryParams = queryParams.filter(p => !p.required);
    
    // 必选查询参数作为独立参数
    requiredQueryParams.forEach(param => {
      const paramType = this.addTypesPrefix(param.type);
      requiredParams.push(`${param.name}: ${paramType}`);
    });
    
    // 可选查询参数组合成 params 对象
    if (optionalQueryParams.length > 0) {
      const queryType = this.generateQueryParamsType(optionalQueryParams);
      optionalParams.push(`params?: ${queryType}`);
    }
    
    // 配置参数（总是可选的）
    optionalParams.push('config?: AxiosRequestConfig');
    
    // 合并参数：必选参数在前，可选参数在后
     const params = [...requiredParams, ...optionalParams];
     
     // 返回类型
    const successResponse = endpoint.responses.find(r => r.statusCode.startsWith('2'));
    const returnType = successResponse ? this.addTypesPrefix(successResponse.type) : 'any';

    // 生成注释
    if (endpoint.summary || endpoint.description) {
      lines.push(`  /**`);
      if (endpoint.summary) {
        lines.push(`   * ${endpoint.summary}`);
      }
      if (endpoint.description && endpoint.description !== endpoint.summary) {
        lines.push(`   * ${endpoint.description}`);
      }
      lines.push(`   */`);
    }
    
    // 生成方法
    const paramsStr = params.join(', ');
    lines.push(`  async ${methodName}(${paramsStr}): Promise<${returnType}> {`);
    
    // 构建 URL
    let url = endpoint.path;
    pathParams.forEach(param => {
      url = url.replace(`{${param.name}}`, `\${${param.name}}`);
    });
    
    // 生成请求调用
    const hasPathParams = pathParams.length > 0;
    const requestParams: string[] = [hasPathParams ? `\`${url}\`` : `'${url}'`];
    
    if (bodyParam) {
      requestParams.push('data');
    }
    
    // 添加配置对象
    const configParts: string[] = [];
    
    if (queryParams.length > 0) {
      if (requiredQueryParams.length > 0 && optionalQueryParams.length > 0) {
        // 同时有必选和可选查询参数
        const requiredParamsObj = requiredQueryParams.map(p => `${p.name}`).join(', ');
        configParts.push(`params: { ${requiredParamsObj}, ...params }`);
      } else if (requiredQueryParams.length > 0) {
        // 只有必选查询参数
        const requiredParamsObj = requiredQueryParams.map(p => `${p.name}`).join(', ');
        configParts.push(`params: { ${requiredParamsObj} }`);
      } else {
        // 只有可选查询参数
        configParts.push('params');
      }
    }
    
    configParts.push('...config');
    
    if (configParts.length > 0) {
      requestParams.push(`{ ${configParts.join(', ')} }`);
    }
    
    const method = endpoint.method.toLowerCase();
    lines.push(`    return this.${this.config.axiosInstance || 'apiClient'}.${method}(${requestParams.join(', ')});`);
    lines.push(`  }`);
    
    return lines;
  }

  private generateMethodName(endpoint: ApiEndpoint): string {
    if (endpoint.operationId) {
      return this.toCamelCase(endpoint.operationId);
    }
    
    // 根据路径和方法生成方法名
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith('{'));
    const lastPart = pathParts[pathParts.length - 1] || 'api';
    const method = endpoint.method.toLowerCase();
    
    return this.toCamelCase(`${method}_${lastPart}`);
  }

  private generateQueryParamsType(queryParams: any[]): string {
    const props = queryParams.map(param => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${param.type}`;
    });
    
    return `{ ${props.join('; ')} }`;
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase());
  }

  private addTypesPrefix(type: string): string {
    // 基础类型不需要添加前缀
    const basicTypes = ['string', 'number', 'boolean', 'any', 'void', 'object', 'unknown'];
    // TypeScript 内置泛型类型
    const builtinGenericTypes = ['Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude', 'Extract', 'NonNullable', 'ReturnType', 'InstanceType', 'ThisType', 'Parameters', 'ConstructorParameters'];
    
    // 处理对象类型（如 { file: string }）
    if (type.startsWith('{') && type.endsWith('}')) {
      return type;
    }
    
    // 处理数组类型
    if (type.endsWith('[]')) {
      const baseType = type.slice(0, -2);
      if (basicTypes.includes(baseType)) {
        return type;
      }
      return `Types.${baseType}[]`;
    }
    
    // 处理泛型类型
    if (type.includes('<')) {
      // 检查是否是内置泛型类型（如 Record<string, any>）
      const genericTypeName = type.split('<')[0];
      if (builtinGenericTypes.includes(genericTypeName)) {
        return type; // 直接返回，不添加 Types. 前缀
      }
      
      return type.replace(/([A-Z][a-zA-Z0-9]*)/g, (match) => {
        if (basicTypes.includes(match) || builtinGenericTypes.includes(match)) {
          return match;
        }
        return `Types.${match}`;
      });
    }
    
    // 基础类型直接返回
    if (basicTypes.includes(type)) {
      return type;
    }
    
    // 自定义类型添加前缀
    return `Types.${type}`;
  }

  private async generateIndex(): Promise<void> {
    const lines: string[] = [];
    
    lines.push('// 自动生成的入口文件');
    lines.push('// 请勿手动修改此文件');
    lines.push('');
    lines.push('export * from \'./types\';');
    
    if (this.config.generateClient !== false) {
      lines.push('export * from \'./api\';');
    }
    
    const content = lines.join('\n');
    const filePath = path.join(this.config.output, 'index.ts');
    await fs.writeFile(filePath, content, 'utf-8');
  }
}