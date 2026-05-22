# Swagger to TypeScript Axios

从 Swagger/OpenAPI 规范自动生成 TypeScript 接口定义和类型安全的 Axios API 客户端。

npm 包名：`swagger-to-ts-axios`，CLI 命令：`swagger-to-ts`。

## 特性

- **自动生成 TypeScript 接口** — 从 Swagger/OpenAPI 规范生成完整类型定义
- **类型安全的 API 客户端** — 基于 Axios 的类型安全 HTTP 客户端
- **多格式输入** — 支持 JSON / YAML 规范文件及远程 URL
- **灵活的配置** — 支持 JSON / YAML / JS / TS 配置文件，可单文件多配置或多文件批量生成
- **Swagger 2.0 & OpenAPI 3.0** — 同时兼容两种规范
- **统一响应解包** — 适配 `{ code, data, message }` 等常见后端包装结构
- **模块化输出** — 可按 tag 拆分为多个 API 模块
- **拦截器注入** — 配置文件中的拦截器会嵌入生成代码
- **规范校验** — `validate` 命令可预检 Swagger/OpenAPI 文件并输出警告摘要
- **远程拉取超时** — 从 URL 加载规范时可配置 `fetchTimeout`

## 环境要求

- Node.js >= 16

## 安装

```bash
# 全局安装
npm install -g swagger-to-ts-axios

# 或者作为项目依赖
npm install swagger-to-ts-axios

# 项目内直接运行（无需全局安装）
npx swagger-to-ts generate -i ./swagger.json -o ./src/api
```

## 快速开始

### 命令行参数

```bash
# 从本地 JSON 文件生成
swagger-to-ts generate -i ./swagger.json -o ./src/api

# 从 YAML 文件生成
swagger-to-ts generate -i ./openapi.yaml -o ./src/api

# 从远程 URL 生成
swagger-to-ts generate -i https://petstore.swagger.io/v2/swagger.json -o ./src/api

# 指定 API 基础 URL 与类型前缀
swagger-to-ts generate -i ./swagger.json -o ./src/api -b /api -p Api

# 只生成类型，不生成客户端
swagger-to-ts generate -i ./swagger.json -o ./src/api --no-client

# 解包统一响应结构（默认解包 data 字段）
swagger-to-ts generate -i ./swagger.json -o ./src/api --response-wrapper

# 按 tag 拆分模块、过滤端点
swagger-to-ts generate -i ./swagger.json -o ./src/api --split-by-tag --filter-tags user,order

# 远程 URL 拉取超时（毫秒，默认 30000）
swagger-to-ts generate -i https://petstore.swagger.io/v2/swagger.json -o ./src/api --fetch-timeout 60000
```

### 使用配置文件

```bash
# 创建配置文件模板（按扩展名自动选择格式）
swagger-to-ts init -o swagger-to-ts.config.json
swagger-to-ts init -o swagger-to-ts.config.ts
swagger-to-ts init -o swagger-to-ts.config.yaml --multi

# 使用单个配置文件
swagger-to-ts generate -c swagger-to-ts.config.json

# 使用多个配置文件
swagger-to-ts generate -c config.json -c config.yaml
swagger-to-ts generate -c config-a.json,config-b.yaml
```

### 编程方式

主要 API：

| 导出 | 说明 |
|------|------|
| `generateFromSwagger` | 按配置生成代码 |
| `createDefaultConfig` | 创建默认配置对象 |
| `loadConfigFiles` / `loadConfigFile` | 加载配置文件（支持多配置） |
| `loadSpec` / `validateSpecStructure` | 加载并校验 Swagger/OpenAPI 规范 |
| `SwaggerParser` | 解析规范，获取端点与类型 |
| `filterEndpoints` | 按配置过滤端点 |

```typescript
import { generateFromSwagger, createDefaultConfig, loadConfigFiles } from 'swagger-to-ts-axios';

// 方式 1：直接传入配置
async function generateOne() {
  const config = createDefaultConfig('./swagger.json', './src/api');
  config.baseURL = '/api';
  config.typePrefix = 'Api';
  await generateFromSwagger(config);
}

// 方式 2：加载配置文件（支持 json/yaml/js/ts，支持多配置）
async function generateFromFile() {
  const configs = await loadConfigFiles(['swagger-to-ts.config.ts']);
  for (const config of configs) {
    await generateFromSwagger(config);
  }
}
```

## 命令行选项

### `generate`

```bash
swagger-to-ts generate [options]
```

| 选项 | 说明 |
|------|------|
| `-i, --input <file>` | Swagger/OpenAPI 文件路径（JSON/YAML）或 URL |
| `-o, --output <dir>` | 输出目录 |
| `-b, --base-url <url>` | API 基础 URL |
| `-p, --type-prefix <prefix>` | 类型前缀 |
| `--no-client` | 不生成 API 客户端 |
| `-c, --config <paths...>` | 配置文件，支持 json/yaml/js/ts，可指定多个 |
| `--response-wrapper [field]` | 解包统一响应结构，默认字段 `data` |
| `--filter-tags <tags>` | 只生成指定 tag，逗号分隔 |
| `--filter-paths <paths>` | 只生成指定路径，逗号分隔，支持 `*` 通配 |
| `--exclude-deprecated` | 排除 deprecated 端点 |
| `--split-by-tag` | 按 tag 拆分为 `modules/*.ts` |
| `--silent-warnings` | 解析时不逐条打印警告（与默认行为一致） |
| `--fetch-timeout <ms>` | 远程 URL 拉取超时（毫秒），默认 `30000` |

> 使用 `-c` 时，命令行选项会覆盖配置文件中的同名字段。  
> `--silent-warnings` 只能设为开启；若要在解析过程中实时看到警告，请在配置文件中设置 `"silentWarnings": false`。

### `init`

```bash
swagger-to-ts init [options]
```

| 选项 | 说明 |
|------|------|
| `-o, --output <file>` | 配置文件输出路径（默认 `swagger-to-ts.config.json`） |
| `--multi` | 生成多配置模板 |

支持的配置文件扩展名：`.json`、`.yaml`、`.yml`、`.js`、`.cjs`、`.mjs`、`.ts`、`.mts`、`.cts`

### `validate`

```bash
swagger-to-ts validate -i <file>
swagger-to-ts validate -i https://petstore.swagger.io/v2/swagger.json --report
```

| 选项 | 说明 |
|------|------|
| `-i, --input <file>` | Swagger/OpenAPI 文件路径或 URL（必需） |
| `--report` | 输出完整规范警告列表 |

## 配置文件

### 支持的格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| JSON | `.json` | 最常用，适合简单配置 |
| YAML | `.yaml`, `.yml` | 适合多配置场景 |
| JavaScript | `.js`, `.cjs`, `.mjs` | 可使用 `module.exports` |
| TypeScript | `.ts`, `.mts`, `.cts` | 使用 `export default`，支持类型提示 |

### 单配置示例

**JSON**

```json
{
  "input": "https://petstore.swagger.io/v2/swagger.json",
  "output": "./src/api/petstore",
  "baseURL": "/api",
  "typePrefix": "",
  "axiosInstance": "apiClient",
  "generateClient": true,
  "responseWrapper": { "field": "data" },
  "excludeDeprecated": true,
  "splitByTag": false,
  "fetchTimeout": 60000,
  "silentWarnings": true
}
```

**TypeScript**

```typescript
import type { GeneratorConfig } from 'swagger-to-ts-axios';

const config: GeneratorConfig = {
  input: 'https://petstore.swagger.io/v2/swagger.json',
  output: './src/api/petstore',
  baseURL: '/api',
  axiosInstance: 'apiClient',
  generateClient: true,
  interceptors: {
    request: {
      onFulfilled: `(config) => {
        config.headers['Authorization'] = 'Bearer token';
        return config;
      }`
    }
  }
};

export default config;
```

**JavaScript**

```javascript
module.exports = {
  input: './openapi.yaml',
  output: './src/api',
  baseURL: '/api',
  generateClient: true
};
```

**YAML**

```yaml
input: ./openapi.yaml
output: ./src/api
baseURL: /api
generateClient: true
responseWrapper:
  field: data
```

### 多配置示例

单个文件内可声明多个配置，支持以下三种写法：

**数组形式（JSON / YAML / TS / JS）**

```json
[
  {
    "input": "https://petstore.swagger.io/v2/swagger.json",
    "output": "./src/api/petstore",
    "baseURL": "/api"
  },
  {
    "input": "./other-swagger.json",
    "output": "./src/api/other",
    "baseURL": "/other"
  }
]
```

**configs 包装形式**

```yaml
configs:
  - input: https://petstore.swagger.io/v2/swagger.json
    output: ./src/api/petstore
    baseURL: /api
  - input: ./other-swagger.json
    output: ./src/api/other
    baseURL: /other
```

**多个配置文件**

```bash
swagger-to-ts generate -c swagger-to-ts.config.json -c swagger-to-ts.other.yaml
```

### 配置项说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `input` | `string` | Swagger/OpenAPI 文件路径或 URL（必需） |
| `output` | `string` | 输出目录（必需） |
| `baseURL` | `string` | API 基础 URL |
| `typePrefix` | `string` | 生成的类型前缀 |
| `axiosInstance` | `string` | Axios 实例名称（默认 `apiClient`） |
| `generateClient` | `boolean` | 是否生成 API 客户端（默认 `true`） |
| `interceptors` | `object` | 默认拦截器，函数字符串会嵌入生成代码 |
| `responseWrapper` | `boolean \| { field?: string }` | 解包统一响应结构，默认解包 `data` |
| `filterTags` | `string[]` | 只生成指定 tag 的端点 |
| `filterPaths` | `string[]` | 只生成路径匹配的端点，支持 `*` 通配 |
| `excludeDeprecated` | `boolean` | 排除 deprecated 端点 |
| `splitByTag` | `boolean` | 按 tag 拆分为 `modules/*.ts` |
| `silentWarnings` | `boolean` | 解析时是否逐条打印警告（默认 `true`）；生成结束后仍会汇总输出警告列表 |
| `fetchTimeout` | `number` | 远程 URL 拉取超时（毫秒），默认 `30000` |

### 拦截器配置

JSON / YAML 中拦截器函数需以**字符串**形式提供，生成时会嵌入到 `api.ts`：

```json
{
  "input": "./swagger.json",
  "output": "./src/api",
  "interceptors": {
    "request": {
      "onFulfilled": "(config) => { config.headers['X-API-Key'] = 'your-api-key'; return config; }",
      "onRejected": "(error) => Promise.reject(error)"
    },
    "response": {
      "onFulfilled": "(response) => response",
      "onRejected": "(error) => Promise.reject(error)"
    }
  }
}
```

`.js` / `.ts` 配置文件中同样使用字符串形式（以便嵌入生成代码），或在生成后于业务代码中动态设置拦截器。

## 生成的文件结构

**默认模式**

```
src/api/
├── index.ts      # 入口文件
├── types.ts      # 类型定义
└── api.ts        # API 客户端
```

**仅生成类型（`--no-client` 或 `generateClient: false`）**

```
src/api/
├── index.ts
└── types.ts
```

**按 tag 拆分（`splitByTag: true`）**

```
src/api/
├── index.ts
├── types.ts
├── api.ts        # ApiClient 基类 + 子模块组合
└── modules/
    ├── user.ts   # UserApi
    └── order.ts  # OrderApi
```

中文 tag 会保留 ASCII 片段并追加 hash，确保文件名与类名合法，例如 `用户` → `modules/tag-xxxxx.ts`，`apiClient` 上对应属性名见生成代码中的 JSDoc 注释。

## 使用示例

### 基本使用

```typescript
import { apiClient, Pet, NewPet } from './src/api';

// 默认 response interceptor 已返回 response.data（或解包后的 data 字段）
const pets = await apiClient.listPets({ limit: 10 });
console.log(pets); // 类型: Pet[]

const newPet: NewPet = { name: '小白', status: 'available' };
const createdPet = await apiClient.createPet(newPet);
console.log(createdPet); // 类型: Pet
```

### 自定义客户端

```typescript
import { ApiClient } from './src/api';

const customClient = new ApiClient({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    Authorization: 'Bearer your-token'
  }
});

const pets = await customClient.listPets();
```

### 按 tag 拆分后的用法

```typescript
import { apiClient } from './src/api';

// apiClient.user / apiClient.order 等子模块
const users = await apiClient.user.getUsers();
```

### 自定义拦截器

```typescript
import { ApiClient } from './src/api';

const client = new ApiClient({
  baseURL: '/api',
  interceptors: {
    request: {
      onFulfilled: (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      }
    },
    response: {
      onFulfilled: (response) => response,
      onRejected: (error) => Promise.reject(error)
    }
  }
});

client.setRequestInterceptor(
  (config) => config,
  (error) => Promise.reject(error)
);
client.clearInterceptors();
```

### 错误处理

```typescript
import { ApiError } from './src/api';

try {
  const pet = await apiClient.showPetById(123);
  console.log(pet);
} catch (error) {
  const apiError = error as ApiError;
  console.error(`API 错误 ${apiError.status}: ${apiError.message}`);
}
```

## 高级用法

### 统一响应解包

后端返回 `{ code: 0, data: T, message: string }` 时：

```bash
swagger-to-ts generate -i ./swagger.json -o ./src/api --response-wrapper data
```

或在配置中：

```json
{
  "responseWrapper": { "field": "data" }
}
```

生成代码会自动：

- 将 API 方法的返回类型推断为 `data` 字段的内层类型
- 默认 response interceptor 返回 `response.data.data`

### 过滤端点

```bash
# 只生成 user、order 两个 tag
swagger-to-ts generate -i ./swagger.json -o ./src/api --filter-tags user,order

# 只生成 /users 开头的路径
swagger-to-ts generate -i ./swagger.json -o ./src/api --filter-paths "/users/*"

# 排除废弃接口
swagger-to-ts generate -i ./swagger.json -o ./src/api --exclude-deprecated
```

`filterPaths` 支持精确匹配、前缀匹配（如 `/users`）以及 `*` 通配（如 `/users/*`）。

### 预检验证

生成前可先验证规范文件：

```bash
swagger-to-ts validate -i ./swagger.json
swagger-to-ts validate -i https://petstore.swagger.io/v2/swagger.json --report
```

`--report` 会输出完整规范警告列表；不加该参数时仅显示警告数量。

生成命令结束后也会汇总打印警告列表。若希望在解析过程中实时看到每条警告，请在配置中设置 `"silentWarnings": false`。

### 类型扩展

```typescript
import { Pet as GeneratedPet } from './src/api';

interface ExtendedPet extends GeneratedPet {
  customField?: string;
}
```

## 测试

```bash
npm test
npm run test:coverage
```

## 开发

```bash
git clone https://github.com/Aii-Group/Swagger-To-TS.git
cd Swagger-To-TS
npm install
npm run dev    # 监听编译
npm run build  # 构建 CJS + ESM

# 本地调试 CLI
node dist/cjs/cli.js generate -i ./swagger.json -o ./src/api
node dist/cjs/cli.js validate -i ./swagger.json --report
```

库同时提供 CommonJS（`dist/cjs`）与 ESM（`dist/esm`）两种构建产物，可按项目模块系统选择导入方式。

## 支持的 Swagger/OpenAPI 特性

### Swagger 2.0

- 基本类型（string, number, boolean, array, object）
- 引用类型（$ref）
- 枚举类型
- 路径 / 查询 / 请求体参数
- formData / multipart 上传
- 响应类型与 tag 分组

### OpenAPI 3.0

- Components/Schemas
- RequestBody 与多 content-type（优先 `application/json`）
- 多 server 支持
- nullable、oneOf / anyOf / allOf
- deprecated 标记（生成 `@deprecated` JSDoc）

## 贡献

欢迎贡献代码！

1. Fork 项目
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 许可证

本项目基于 MIT 许可证 — 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- [Swagger/OpenAPI](https://swagger.io/) — API 规范标准
- [Axios](https://axios-http.com/) — HTTP 客户端库
- [TypeScript](https://www.typescriptlang.org/) — 类型安全的 JavaScript
- [Commander.js](https://github.com/tj/commander.js/) — 命令行工具框架

## 支持

- [提交 Issue](https://github.com/Aii-Group/Swagger-To-TS/issues)
- [参与讨论](https://github.com/Aii-Group/Swagger-To-TS/discussions)
- 发送邮件到 aii_group@163.com
