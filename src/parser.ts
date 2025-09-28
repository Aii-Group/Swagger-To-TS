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
  PropertyDefinition
} from './types';

export class SwaggerParser {
  private spec: SwaggerSpec;
  private definitions: Map<string, SwaggerSchema> = new Map();

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
    // 判断是否为 URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return this.fromUrl(input);
    } else {
      return this.fromFile(input);
    }
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
    const endpoints: ApiEndpoint[] = [];

    Object.entries(this.spec.paths).forEach(([path, pathItem]) => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
      
      methods.forEach(method => {
        const operation = pathItem[method];
        if (operation) {
          endpoints.push(this.parseOperation(path, method, operation));
        }
      });
    });

    return endpoints;
  }

  private parseOperation(path: string, method: string, operation: SwaggerOperation): ApiEndpoint {
    const allParameters = operation.parameters || [];
    const parameters = this.parseParameters(allParameters.filter(p => p.in !== 'body'));
    const requestBody = this.parseRequestBody(operation.requestBody, allParameters);
    const responses = this.parseResponses(operation.responses);

    return {
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      parameters,
      requestBody,
      responses,
      tags: operation.tags
    };
  }

  private parseParameters(parameters: SwaggerParameter[]): ApiParameter[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      type: this.resolveType(param.schema || { type: param.type }),
      required: param.required || false,
      description: param.description
    }));
  }

  private parseRequestBody(requestBody?: any, allParameters?: SwaggerParameter[]): ApiRequestBody | undefined {
    // 处理 Swagger 2.0 的 body 参数
    if (allParameters) {
      const bodyParam = allParameters.find(p => p.in === 'body');
      if (bodyParam) {
        return {
          type: this.resolveType(bodyParam.schema || { type: 'any' }),
          required: bodyParam.required || false,
          description: bodyParam.description
        };
      }

      // 处理 Swagger 2.0 的 formData 参数
      const formDataParams = allParameters.filter(p => p.in === 'formData');
      if (formDataParams.length > 0) {
        const formDataFields: { [key: string]: { type: string; required: boolean; description?: string } } = {};
        
        formDataParams.forEach(param => {
          let paramType = 'any';
          if (param.type) {
            if (param.type === 'string' && param.format === 'binary') {
              paramType = 'File';
            } else if (param.type === 'file') {
              paramType = 'File';
            } else if (param.type === 'array' && param.items) {
              paramType = `${this.resolveType(param.items)}[]`;
            } else {
              paramType = param.type;
            }
          } else if (param.schema) {
            paramType = this.resolveType(param.schema);
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
      const contentType = Object.keys(requestBody.content)[0];
      const schema = requestBody.content[contentType]?.schema;
      
      // 检查是否为 multipart/form-data
      if (contentType === 'multipart/form-data' && schema?.properties) {
        const formDataFields: { [key: string]: { type: string; required: boolean; description?: string } } = {};
        
        Object.entries(schema.properties).forEach(([key, prop]) => {
          formDataFields[key] = {
            type: this.resolveType(prop as SwaggerSchema),
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
      }

      return {
        type: this.resolveType(schema),
        required: requestBody.required || false,
        description: requestBody.description,
        contentType
      };
    }

    return undefined;
  }

  private parseResponses(responses: any): ApiResponse[] {
    return Object.entries(responses).map(([statusCode, response]: [string, any]) => {
      let type = 'void';
      
      // Swagger 2.0
      if (response.schema) {
        type = this.resolveType(response.schema);
      }
      
      // OpenAPI 3.0
      if (response.content) {
        const contentType = Object.keys(response.content)[0];
        const schema = response.content[contentType]?.schema;
        if (schema) {
          type = this.resolveType(schema);
        }
      }

      return {
        statusCode,
        type,
        description: response.description || ''
      };
    });
  }

  private resolveType(schema: SwaggerSchema): string {
    if (!schema) return 'any';

    // 处理引用
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return refName || 'any';
    }

    // 处理基本类型
    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return schema.enum.map(v => `'${v}'`).join(' | ');
        }
        // 处理文件上传类型
        if (schema.format === 'binary') {
          return 'File';
        }
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        if (schema.items) {
          return `${this.resolveType(schema.items)}[]`;
        }
        return 'any[]';
      case 'object':
        if (schema.properties) {
          const props = Object.entries(schema.properties)
            .map(([key, prop]) => {
              const required = schema.required?.includes(key) || false;
              const optional = required ? '' : '?';
              const propType = this.resolveType(prop);
              return `${key}${optional}: ${propType}`;
            })
            .join('; ');
          return `{ ${props} }`;
        }
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }

  getTypeDefinitions(): TypeDefinition[] {
    const types: TypeDefinition[] = [];

    this.definitions.forEach((schema, name) => {
      const type = this.generateTypeDefinition(name, schema);
      if (type) {
        types.push(type);
      }
    });

    return types;
  }

  private generateTypeDefinition(name: string, schema: SwaggerSchema): TypeDefinition | null {
    if (schema.type === 'object' && schema.properties) {
      const properties: { [name: string]: PropertyDefinition } = {};
      
      Object.entries(schema.properties).forEach(([propName, propSchema]) => {
        properties[propName] = {
          type: this.resolveType(propSchema),
          required: schema.required?.includes(propName) || false,
          description: propSchema.description
        };
      });

      return {
        name,
        type: 'interface',
        properties,
        description: schema.description
      };
    }

    // 处理枚举类型
    if (schema.enum) {
      return {
        name,
        type: 'enum',
        description: schema.description
      };
    }

    // 处理类型别名
    return {
      name,
      type: 'type',
      description: schema.description
    };
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