// Swagger/OpenAPI 类型定义
export interface SwaggerSpec {
  swagger?: string;
  openapi?: string;
  info: SwaggerInfo;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: SwaggerPaths;
  definitions?: SwaggerDefinitions;
  components?: SwaggerComponents;
  servers?: SwaggerServer[];
}

export interface SwaggerInfo {
  title: string;
  version: string;
  description?: string;
}

export interface SwaggerServer {
  url: string;
  description?: string;
}

export interface SwaggerPaths {
  [path: string]: SwaggerPathItem;
}

export interface SwaggerPathItem {
  get?: SwaggerOperation;
  post?: SwaggerOperation;
  put?: SwaggerOperation;
  delete?: SwaggerOperation;
  patch?: SwaggerOperation;
  options?: SwaggerOperation;
  head?: SwaggerOperation;
  parameters?: SwaggerParameter[];
}

export interface SwaggerOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
  responses: SwaggerResponses;
}

export interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  description?: string;
  required?: boolean;
  type?: string;
  format?: string;
  schema?: SwaggerSchema;
  items?: SwaggerSchema;
  collectionFormat?: string;
  enum?: any[];
}

export interface SwaggerRequestBody {
  description?: string;
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: SwaggerSchema;
    };
  };
}

export interface SwaggerResponses {
  [statusCode: string]: SwaggerResponse;
}

export interface SwaggerResponse {
  description: string;
  schema?: SwaggerSchema;
  content?: {
    [mediaType: string]: {
      schema: SwaggerSchema;
    };
  };
}

export interface SwaggerDefinitions {
  [name: string]: SwaggerSchema;
}

export interface SwaggerComponents {
  schemas?: SwaggerDefinitions;
}

export interface SwaggerSchema {
  type?: string;
  format?: string;
  items?: SwaggerSchema;
  properties?: { [name: string]: SwaggerSchema };
  additionalProperties?: SwaggerSchema | boolean;
  required?: string[];
  enum?: any[];
  $ref?: string;
  allOf?: SwaggerSchema[];
  oneOf?: SwaggerSchema[];
  anyOf?: SwaggerSchema[];
  not?: SwaggerSchema;
  description?: string;
  example?: any;
  default?: any;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  title?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// 规范校验警告
export interface ValidationWarning {
  type: 'invalidName' | 'missingField' | 'invalidFormat' | 'nonCompliant';
  message: string;
  location?: string;
}

// 生成的接口信息
export interface ApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  tags?: string[];
  warnings?: string[];
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  type: string;
  required: boolean;
  description?: string;
}

export interface ApiRequestBody {
  type: string;
  required: boolean;
  description?: string;
  contentType?: string;
  isFormData?: boolean;
  formDataFields?: { [key: string]: { type: string; required: boolean; description?: string } };
}

export interface ApiResponse {
  statusCode: string;
  type: string;
  description: string;
}

export interface TypeDefinition {
  name: string;
  type: 'interface' | 'enum' | 'type';
  properties?: { [name: string]: PropertyDefinition };
  enumValues?: string[];
  aliasType?: string;
  description?: string;
  warnings?: string[];
}

export interface PropertyDefinition {
  type: string;
  required: boolean;
  description?: string;
}

// 拦截器类型定义
export interface RequestInterceptor {
  onFulfilled?: (config: any) => any | Promise<any>;
  onRejected?: (error: any) => any;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: any) => any | Promise<any>;
  onRejected?: (error: any) => any;
}

export interface InterceptorConfig {
  request?: RequestInterceptor;
  response?: ResponseInterceptor;
}

// 生成配置
export interface GeneratorConfig {
  input: string;
  output: string;
  baseURL?: string;
  axiosInstance?: string;
  typePrefix?: string;
  generateClient?: boolean;
  interceptors?: InterceptorConfig;
}
