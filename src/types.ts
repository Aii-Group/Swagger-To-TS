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
  deprecated?: boolean;
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
  enum?: unknown[];
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

export interface SwaggerDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface SwaggerSchema {
  type?: string;
  format?: string;
  items?: SwaggerSchema;
  properties?: { [name: string]: SwaggerSchema };
  additionalProperties?: SwaggerSchema | boolean;
  required?: string[];
  enum?: unknown[];
  $ref?: string;
  allOf?: SwaggerSchema[];
  oneOf?: SwaggerSchema[];
  anyOf?: SwaggerSchema[];
  not?: SwaggerSchema;
  description?: string;
  example?: unknown;
  default?: unknown;
  const?: unknown;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  title?: string;
  discriminator?: SwaggerDiscriminator;
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
  deprecated?: boolean;
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
  onFulfilled?: (config: unknown) => unknown | Promise<unknown>;
  onRejected?: (error: unknown) => unknown;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: unknown) => unknown | Promise<unknown>;
  onRejected?: (error: unknown) => unknown;
}

export interface InterceptorConfig {
  request?: RequestInterceptor;
  response?: ResponseInterceptor;
}

/** JSON 配置文件中 interceptors 函数字符串（生成时嵌入代码） */
export interface InterceptorConfigStrings {
  request?: {
    onFulfilled?: string;
    onRejected?: string;
  };
  response?: {
    onFulfilled?: string;
    onRejected?: string;
  };
}

export interface ResponseWrapperConfig {
  /** 响应体中数据字段名，默认 data */
  field?: string;
}

export interface ParserOptions {
  /** 为 true 时不立即打印警告，由调用方汇总输出 */
  silentWarnings?: boolean;
  /** 远程 URL 拉取超时（毫秒），默认 30000 */
  fetchTimeout?: number;
  /** 关闭 TLS 证书校验（自签名证书）；HTTPS+IP 默认已跳过 hostname 校验 */
  insecure?: boolean;
}

// 生成配置
export interface GeneratorConfig {
  input: string;
  output: string;
  baseURL?: string;
  axiosInstance?: string;
  typePrefix?: string;
  generateClient?: boolean;
  interceptors?: InterceptorConfigStrings;
  /** 解包统一响应结构，如 { code, data, message } */
  responseWrapper?: ResponseWrapperConfig | boolean;
  /** 只生成指定 tag 的端点 */
  filterTags?: string[];
  /** 只生成路径匹配的端点，支持 * 通配 */
  filterPaths?: string[];
  /** 排除 deprecated 端点 */
  excludeDeprecated?: boolean;
  /** 按 tag 拆分为 modules/*.ts */
  splitByTag?: boolean;
  /** 不立即打印规范警告 */
  silentWarnings?: boolean;
  /** 远程 URL 拉取超时（毫秒），默认 30000 */
  fetchTimeout?: number;
  /** 关闭 TLS 证书校验（自签名证书）；HTTPS+IP 默认已跳过 hostname 校验 */
  insecure?: boolean;
}
