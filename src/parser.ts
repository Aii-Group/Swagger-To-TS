import * as fs from 'fs-extra';
import axios from 'axios';
import {
  SwaggerSpec,
  SwaggerSchema,
  SwaggerOperation,
  SwaggerParameter,
  ApiEndpoint,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  TypeDefinition,
  PropertyDefinition,
  ValidationWarning
} from './types';

export class SwaggerParser {
  private spec: SwaggerSpec;
  private definitions: Map<string, SwaggerSchema> = new Map();
  private typeNameMapping: Map<string, string> = new Map();
  private usedTypeNames: Set<string> = new Set();
  private warnings: ValidationWarning[] = [];
  private unknownTypeCounter = 0;
  private cachedEndpoints: ApiEndpoint[] | null = null;
  private cachedTypeDefinitions: TypeDefinition[] | null = null;

  constructor(spec: SwaggerSpec) {
    this.spec = spec;
    this.loadDefinitions();
  }

  static async fromFile(filePath: string): Promise<SwaggerParser> {
    const content = await fs.readFile(filePath, 'utf-8');
    const spec = JSON.parse(content) as SwaggerSpec;
    return new SwaggerParser(spec);
  }

  static async fromUrl(url: string): Promise<SwaggerParser> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml'
        }
      });
      const spec = response.data as SwaggerSpec;
      return new SwaggerParser(spec);
    } catch (error) {
      throw new Error(`Failed to fetch Swagger spec from URL: ${url}. Error: ${error}`);
    }
  }

  static async fromInput(input: string): Promise<SwaggerParser> {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return this.fromUrl(input);
    } else {
      return this.fromFile(input);
    }
  }

  private addWarning(warning: ValidationWarning): void {
    this.warnings.push(warning);
    console.warn(`[Swagger 规范警告] ${warning.location ? `[${warning.location}] ` : ''}${warning.message}`);
  }

  getWarnings(): ValidationWarning[] {
    return this.warnings;
  }

  private loadDefinitions(): void {
    // Swagger 2.0
    if (this.spec.definitions) {
      Object.entries(this.spec.definitions).forEach(([name, schema]) => {
        this.definitions.set(name, schema);
      });
    }

    // OpenAPI 3.0
    if (this.spec.components?.schemas) {
      Object.entries(this.spec.components.schemas).forEach(([name, schema]) => {
        this.definitions.set(name, schema);
      });
    }
  }

  getApiEndpoints(): ApiEndpoint[] {
    if (this.cachedEndpoints) return this.cachedEndpoints;

    const endpoints: ApiEndpoint[] = [];

    Object.entries(this.spec.paths).forEach(([path, pathItem]) => {
      const pathLevelParams = pathItem.parameters || [];
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

      methods.forEach(method => {
        const operation = pathItem[method];
        if (operation) {
          endpoints.push(this.parseOperation(path, method, operation, pathLevelParams));
        }
      });
    });

    this.cachedEndpoints = endpoints;
    return endpoints;
  }

  private parseOperation(
    path: string,
    method: string,
    operation: SwaggerOperation,
    pathLevelParams: SwaggerParameter[] = []
  ): ApiEndpoint {
    const location = `${method.toUpperCase()} ${path}`;
    const endpointWarnings: string[] = [];

    // 合并 path 级别参数和 operation 级别参数（operation 级别优先）
    const operationParams = operation.parameters || [];
    const paramNames = new Set(operationParams.map(p => `${p.in}:${p.name}`));
    const mergedParams = [
      ...operationParams,
      ...pathLevelParams.filter(p => !paramNames.has(`${p.in}:${p.name}`))
    ];

    // 检查 operationId 规范性
    if (!operation.operationId) {
      const warning = `缺少 operationId，将根据路径和方法自动生成方法名`;
      this.addWarning({ type: 'missingField', message: warning, location });
      endpointWarnings.push(warning);
    } else {
      const hasChinese = /[\u4e00-\u9fff]/.test(operation.operationId);
      const hasInvalidChars = /[^a-zA-Z0-9_\u4e00-\u9fff]/.test(operation.operationId);
      if (hasChinese) {
        const warning = `operationId "${operation.operationId}" 包含中文字符，不符合规范，将自动清理`;
        this.addWarning({ type: 'invalidName', message: warning, location });
        endpointWarnings.push(warning);
      } else if (hasInvalidChars) {
        const warning = `operationId "${operation.operationId}" 包含非法字符，将自动清理`;
        this.addWarning({ type: 'invalidName', message: warning, location });
        endpointWarnings.push(warning);
      }
    }

    const parameters = this.parseParameters(
      mergedParams.filter(p => p.in !== 'body'),
      location
    );
    const requestBody = this.parseRequestBody(operation.requestBody, mergedParams, location);
    const responses = this.parseResponses(operation.responses, location);

    return {
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      parameters,
      requestBody,
      responses,
      tags: operation.tags,
      warnings: endpointWarnings.length > 0 ? endpointWarnings : undefined
    };
  }

  private parseParameters(parameters: SwaggerParameter[], location: string): ApiParameter[] {
    return parameters.map(param => {
      // header 参数在生成代码时会被忽略，只警告一次，不再做类型检查
      if (param.in === 'header') {
        this.addWarning({
          type: 'nonCompliant',
          message: `参数 "${param.name}" 位于 header 中，生成的代码将跳过此参数，请在拦截器中统一处理 header`,
          location
        });
        return {
          name: param.name,
          in: param.in,
          type: 'string',
          required: false,
          description: param.description
        };
      }

      let schema: SwaggerSchema;
      if (param.schema) {
        schema = param.schema;
      } else if (param.type) {
        // Swagger 2.0 风格：参数直接有 type 字段
        schema = {
          type: param.type,
          format: param.format,
          items: param.items,
          enum: param.enum
        };
      } else {
        this.addWarning({
          type: 'missingField',
          message: `参数 "${param.name}" 缺少 type 或 schema 字段，已回退为 any`,
          location
        });
        schema = { type: 'string' };
      }

      return {
        name: param.name,
        in: param.in,
        type: this.resolveType(schema, location),
        required: param.required || param.in === 'path',
        description: param.description
      };
    });
  }

  private parseRequestBody(
    requestBody?: any,
    allParameters?: SwaggerParameter[],
    location?: string
  ): ApiRequestBody | undefined {
    // Swagger 2.0 body 参数
    if (allParameters) {
      const bodyParam = allParameters.find(p => p.in === 'body');
      if (bodyParam) {
        if (!bodyParam.schema) {
          this.addWarning({
            type: 'missingField',
            message: `body 参数 "${bodyParam.name}" 缺少 schema 字段，已回退为 any`,
            location
          });
        }
        return {
          type: this.resolveType(bodyParam.schema || { type: 'object' }, location),
          required: bodyParam.required || false,
          description: bodyParam.description,
          contentType: 'application/json'
        };
      }

      // Swagger 2.0 formData 参数
      const formDataParams = allParameters.filter(p => p.in === 'formData');
      if (formDataParams.length > 0) {
        const formDataFields: { [key: string]: { type: string; required: boolean; description?: string } } = {};

        formDataParams.forEach(param => {
          let paramType: string;
          if (param.type === 'string' && param.format === 'binary') {
            paramType = 'File';
          } else if (param.type === 'file') {
            paramType = 'File';
          } else if (param.type === 'array' && param.items) {
            paramType = `${this.resolveType(param.items, location)}[]`;
          } else if (param.type) {
            paramType = this.resolveType({ type: param.type, format: param.format }, location);
          } else if (param.schema) {
            paramType = this.resolveType(param.schema, location);
          } else {
            paramType = 'any';
          }

          formDataFields[param.name] = {
            type: paramType,
            required: param.required || false,
            description: param.description
          };
        });

        return {
          type: 'FormData',
          required: formDataParams.some(p => p.required),
          description: 'Form data parameters',
          contentType: 'multipart/form-data',
          isFormData: true,
          formDataFields
        };
      }
    }

    // OpenAPI 3.0 requestBody
    if (requestBody?.content) {
      const contentTypes = Object.keys(requestBody.content);
      if (contentTypes.length === 0) {
        this.addWarning({
          type: 'missingField',
          message: `requestBody.content 为空，已跳过`,
          location
        });
        return undefined;
      }

      const contentType = contentTypes[0];
      const schema = requestBody.content[contentType]?.schema;

      if (!schema) {
        this.addWarning({
          type: 'missingField',
          message: `requestBody content "${contentType}" 缺少 schema，已回退为 any`,
          location
        });
        return {
          type: 'any',
          required: requestBody.required || false,
          description: requestBody.description,
          contentType
        };
      }

      // multipart/form-data
      if (contentType === 'multipart/form-data') {
        if (schema.properties) {
          const formDataFields: { [key: string]: { type: string; required: boolean; description?: string } } = {};
          Object.entries(schema.properties).forEach(([key, prop]) => {
            formDataFields[key] = {
              type: this.resolveType(prop as SwaggerSchema, location),
              required: schema.required?.includes(key) || false,
              description: (prop as SwaggerSchema).description
            };
          });
          return {
            type: 'FormData',
            required: requestBody.required || false,
            description: requestBody.description,
            contentType,
            isFormData: true,
            formDataFields
          };
        } else if (schema.$ref || schema.allOf || schema.oneOf || schema.anyOf) {
          // 引用类型的 form-data，退化为普通请求体
          return {
            type: this.resolveType(schema, location),
            required: requestBody.required || false,
            description: requestBody.description,
            contentType
          };
        }
      }

      return {
        type: this.resolveType(schema, location),
        required: requestBody.required || false,
        description: requestBody.description,
        contentType
      };
    }

    return undefined;
  }

  private parseResponses(responses: any, location: string): ApiResponse[] {
    if (!responses || Object.keys(responses).length === 0) {
      this.addWarning({
        type: 'missingField',
        message: `缺少 responses 定义`,
        location
      });
      return [];
    }

    return Object.entries(responses).map(([statusCode, response]: [string, any]) => {
      let type = 'void';

      // Swagger 2.0
      if (response.schema) {
        type = this.resolveType(response.schema, location);
      }

      // OpenAPI 3.0
      if (response.content) {
        const contentTypes = Object.keys(response.content);
        if (contentTypes.length > 0) {
          const schema = response.content[contentTypes[0]]?.schema;
          if (schema) {
            type = this.resolveType(schema, location);
          }
        }
      }

      return {
        statusCode,
        type,
        description: response.description || ''
      };
    });
  }

  /**
   * 将 SwaggerSchema 解析为 TypeScript 类型字符串
   * 严格遵循 OpenAPI/Swagger 规范
   */
  resolveType(schema: SwaggerSchema, location?: string): string {
    if (!schema) return 'any';

    // $ref 优先处理
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      if (!refName) {
        this.addWarning({ type: 'invalidFormat', message: `无法解析 $ref: ${schema.$ref}`, location });
        return 'any';
      }
      return this.sanitizeTypeName(refName);
    }

    // allOf → 交叉类型
    if (schema.allOf && schema.allOf.length > 0) {
      const types = schema.allOf.map(s => this.resolveType(s, location));
      const merged = types.length === 1 ? types[0] : types.join(' & ');
      return schema.nullable ? `(${merged}) | null` : merged;
    }

    // oneOf → 联合类型（语义上是"恰好一个"，TypeScript 中近似 union）
    if (schema.oneOf && schema.oneOf.length > 0) {
      const types = schema.oneOf.map(s => this.resolveType(s, location));
      const merged = types.join(' | ');
      return schema.nullable ? `${merged} | null` : merged;
    }

    // anyOf → 联合类型
    if (schema.anyOf && schema.anyOf.length > 0) {
      const types = schema.anyOf.map(s => this.resolveType(s, location));
      const merged = types.join(' | ');
      return schema.nullable ? `${merged} | null` : merged;
    }

    let resolvedType: string;

    switch (schema.type) {
      case 'string':
        if (schema.enum && schema.enum.length > 0) {
          resolvedType = schema.enum.map(v => `'${String(v)}'`).join(' | ');
        } else if (schema.format === 'binary') {
          resolvedType = 'File';
        } else {
          resolvedType = 'string';
        }
        break;

      case 'integer':
      case 'number':
        if (schema.enum && schema.enum.length > 0) {
          resolvedType = schema.enum.map(v => String(v)).join(' | ');
        } else {
          resolvedType = 'number';
        }
        break;

      case 'boolean':
        resolvedType = 'boolean';
        break;

      case 'array':
        if (schema.items) {
          const itemType = this.resolveType(schema.items, location);
          // 如果 itemType 包含 | 或 &，需要加括号
          resolvedType = (itemType.includes(' | ') || itemType.includes(' & '))
            ? `(${itemType})[]`
            : `${itemType}[]`;
        } else {
          this.addWarning({
            type: 'missingField',
            message: `array 类型缺少 items 字段，已回退为 any[]`,
            location
          });
          resolvedType = 'any[]';
        }
        break;

      case 'object':
        resolvedType = this.resolveObjectType(schema, location);
        break;

      default:
        if (!schema.type) {
          // 无 type 字段但有 properties，推断为 object
          if (schema.properties) {
            resolvedType = this.resolveObjectType({ ...schema, type: 'object' }, location);
          } else if (schema.additionalProperties !== undefined) {
            resolvedType = this.resolveObjectType({ ...schema, type: 'object' }, location);
          } else {
            resolvedType = 'any';
          }
        } else {
          this.addWarning({
            type: 'invalidFormat',
            message: `未知的 schema type: "${schema.type}"，已回退为 any`,
            location
          });
          resolvedType = 'any';
        }
    }

    // nullable 处理（OpenAPI 3.0）
    if (schema.nullable && resolvedType !== 'any') {
      resolvedType = `${resolvedType} | null`;
    }

    return resolvedType;
  }

  private resolveObjectType(schema: SwaggerSchema, location?: string): string {
    if (schema.properties && Object.keys(schema.properties).length > 0) {
      const props = Object.entries(schema.properties)
        .map(([key, prop]) => {
          const required = schema.required?.includes(key) || false;
          const optional = required ? '' : '?';
          const propType = this.resolveType(prop, location);
          const propertyKey = this.toPropertyKey(key);
          return `${propertyKey}${optional}: ${propType}`;
        })
        .join('; ');
      return `{ ${props} }`;
    }

    if (schema.additionalProperties !== undefined) {
      if (schema.additionalProperties === true) {
        return 'Record<string, any>';
      } else if (schema.additionalProperties === false) {
        return 'Record<string, never>';
      } else {
        const valueType = this.resolveType(schema.additionalProperties as SwaggerSchema, location);
        return `Record<string, ${valueType}>`;
      }
    }

    return 'Record<string, any>';
  }

  getTypeDefinitions(): TypeDefinition[] {
    if (this.cachedTypeDefinitions) return this.cachedTypeDefinitions;

    const types: TypeDefinition[] = [];

    this.definitions.forEach((schema, name) => {
      const type = this.generateTypeDefinition(name, schema);
      if (type) {
        types.push(type);
      }
    });

    this.cachedTypeDefinitions = types;
    return types;
  }

  private generateTypeDefinition(name: string, schema: SwaggerSchema): TypeDefinition | null {
    const typeWarnings: string[] = [];
    const sanitizedName = this.sanitizeTypeName(name, typeWarnings);
    const location = `definition: ${name}`;

    // allOf → 交叉类型别名
    if (schema.allOf && schema.allOf.length > 0) {
      const types = schema.allOf.map(s => this.resolveType(s, location));
      const aliasType = types.length === 1 ? types[0] : types.join(' & ');
      return {
        name: sanitizedName,
        type: 'type',
        aliasType: schema.nullable ? `(${aliasType}) | null` : aliasType,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // oneOf → 联合类型别名
    if (schema.oneOf && schema.oneOf.length > 0) {
      const types = schema.oneOf.map(s => this.resolveType(s, location));
      const aliasType = types.join(' | ');
      return {
        name: sanitizedName,
        type: 'type',
        aliasType: schema.nullable ? `${aliasType} | null` : aliasType,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // anyOf → 联合类型别名
    if (schema.anyOf && schema.anyOf.length > 0) {
      const types = schema.anyOf.map(s => this.resolveType(s, location));
      const aliasType = types.join(' | ');
      return {
        name: sanitizedName,
        type: 'type',
        aliasType: schema.nullable ? `${aliasType} | null` : aliasType,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // $ref 顶层引用 → 类型别名
    if (schema.$ref) {
      const aliasType = this.resolveType(schema, location);
      return {
        name: sanitizedName,
        type: 'type',
        aliasType,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // 枚举类型
    if (schema.enum && schema.enum.length > 0) {
      const isString = !schema.type || schema.type === 'string';
      const enumValues = schema.enum.map(v =>
        isString ? `'${String(v)}'` : String(v)
      );
      return {
        name: sanitizedName,
        type: 'enum',
        enumValues,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // object 类型（或无 type 但有 properties）
    if (schema.type === 'object' || schema.properties) {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const properties: { [name: string]: PropertyDefinition } = {};

        Object.entries(schema.properties).forEach(([propName, propSchema]) => {
          const propertyKey = this.toPropertyKey(propName);
          properties[propertyKey] = {
            type: this.resolveType(propSchema, location),
            required: schema.required?.includes(propName) || false,
            description: propSchema.description
          };
        });

        return {
          name: sanitizedName,
          type: 'interface',
          properties,
          description: schema.description,
          warnings: typeWarnings.length > 0 ? typeWarnings : undefined
        };
      }

      // object 类型但无 properties，可能有 additionalProperties
      if (schema.additionalProperties !== undefined) {
        const aliasType = this.resolveObjectType(schema, location);
        return {
          name: sanitizedName,
          type: 'type',
          aliasType,
          description: schema.description,
          warnings: typeWarnings.length > 0 ? typeWarnings : undefined
        };
      }

      // 空 object
      return {
        name: sanitizedName,
        type: 'interface',
        properties: {},
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // 其他基础类型别名（如 type: 'string', type: 'integer' 等）
    if (schema.type) {
      const aliasType = this.resolveType(schema, location);
      return {
        name: sanitizedName,
        type: 'type',
        aliasType,
        description: schema.description,
        warnings: typeWarnings.length > 0 ? typeWarnings : undefined
      };
    }

    // 无任何类型信息
    const warning = `类型 "${name}" 缺少类型信息，已回退为 any`;
    this.addWarning({ type: 'missingField', message: warning, location });
    typeWarnings.push(warning);

    return {
      name: sanitizedName,
      type: 'type',
      aliasType: 'any',
      description: schema.description,
      warnings: typeWarnings.length > 0 ? typeWarnings : undefined
    };
  }

  /**
   * 属性名转换：包含连字符或特殊字符时加引号
   */
  private toPropertyKey(str: string): string {
    if (/[^a-zA-Z0-9_$]/.test(str) || /^[0-9]/.test(str)) {
      return `"${str}"`;
    }
    return str;
  }

  /**
   * 清理类型名，使其符合 TypeScript 标识符规范
   * 遇到不规范的名称时记录警告，不做静默的随机重命名
   */
  private sanitizeTypeName(name: string, warningList?: string[]): string {
    if (!name) return 'UnknownType';

    if (this.typeNameMapping.has(name)) {
      return this.typeNameMapping.get(name)!;
    }

    const hasChinese = /[\u4e00-\u9fff]/.test(name);
    const nonChinesePart = name
      .replace(/[\u4e00-\u9fff]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/^[0-9]+/, '');

    let result: string;

    if (hasChinese) {
      if (nonChinesePart) {
        result = nonChinesePart.charAt(0).toUpperCase() + nonChinesePart.slice(1);
      } else {
        this.unknownTypeCounter++;
        result = `UnknownType${this.unknownTypeCounter}`;
      }
      const warning = `类型名 "${name}" 包含中文字符，不符合规范，已重命名为 "${result}"`;
      this.addWarning({ type: 'invalidName', message: warning });
      warningList?.push(warning);
    } else {
      const cleaned = name
        .replace(/[^a-zA-Z0-9_]/g, '')
        .replace(/^[0-9]+/, '');

      if (!cleaned) {
        this.unknownTypeCounter++;
        result = `UnknownType${this.unknownTypeCounter}`;
        const warning = `类型名 "${name}" 清理后为空，已重命名为 "${result}"`;
        this.addWarning({ type: 'invalidName', message: warning });
        warningList?.push(warning);
      } else {
        result = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        if (result !== name && result !== name.charAt(0).toUpperCase() + name.slice(1)) {
          const warning = `类型名 "${name}" 包含非法字符，已清理为 "${result}"`;
          this.addWarning({ type: 'invalidName', message: warning });
          warningList?.push(warning);
        }
      }
    }

    // 确保唯一性
    if (this.usedTypeNames.has(result)) {
      let counter = 2;
      const base = result;
      while (this.usedTypeNames.has(`${base}${counter}`)) {
        counter++;
      }
      result = `${base}${counter}`;
    }

    this.usedTypeNames.add(result);
    this.typeNameMapping.set(name, result);
    return result;
  }

  getBaseUrl(): string {
    // OpenAPI 3.0
    if (this.spec.servers && this.spec.servers.length > 0) {
      return this.spec.servers[0].url;
    }

    // Swagger 2.0
    const scheme = this.spec.schemes?.[0] || 'https';
    const host = this.spec.host || 'localhost';
    const basePath = this.spec.basePath || '';

    return `${scheme}://${host}${basePath}`;
  }
}
