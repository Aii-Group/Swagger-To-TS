# swagger-to-ts-axios

[![npm version](https://img.shields.io/npm/v/swagger-to-ts-axios.svg?style=flat-square)](https://www.npmjs.com/package/swagger-to-ts-axios)
[![Node.js](https://img.shields.io/node/v/swagger-to-ts-axios.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

将 Swagger / OpenAPI 规范转换为 TypeScript 类型与 Axios 客户端，开箱即用、严格类型、可配置。

CLI：`swagger-to-ts` · npm：`swagger-to-ts-axios`

[安装](#安装) · [快速上手](#快速上手) · [配置](#配置) · [CLI](#cli) · [编程调用](#编程调用) · [开发](#开发)

---

## 它能做什么

给定一份 Swagger 2.0 或 OpenAPI 3.0 规范，工具会：

1. 解析所有 schema，生成 `types.ts`
2. 为每个端点生成带泛型返回值的 Axios 方法，输出 `api.ts`
3. 可选按 tag 拆分为 `modules/*.ts`，或仅输出类型

生成代码遵循现代 TypeScript 实践：`import type`、`unknown` 回退、`Record<string, unknown>` 松散对象，兼容 `verbatimModuleSyntax` 严格检查。

## 功能概览

| 能力 | 说明 |
|------|------|
| 类型安全客户端 | `TypedHttpClient` 泛型封装，方法返回类型与拦截器解包一致 |
| 多输入源 | 本地 JSON/YAML、远程 URL（可设 `fetchTimeout`；HTTPS+IP / 自签名见 `insecure`） |
| 多配置格式 | JSON · YAML · JS · TS，支持单文件多配置与批量生成 |
| 响应解包 | 适配 `{ code, data, message }` 等包装结构 |
| 端点过滤 | 按 tag、路径通配符、deprecated 标记筛选 |
| 模块化 | `splitByTag` 按 tag 拆分 API 模块 |
| 拦截器 | 配置中嵌入默认 request/response 拦截器 |
| 规范校验 | `validate` 命令预检并汇总警告 |

## 安装

需要 Node.js >= 16。

```bash
npm install -g swagger-to-ts-axios   # 全局
npm install swagger-to-ts-axios      # 项目依赖
npx swagger-to-ts --help             # 免安装试用
```

## 快速上手

### 一行命令

```bash
swagger-to-ts generate \
  -i https://petstore.swagger.io/v2/swagger.json \
  -o ./src/api \
  -b /api
```

### 使用配置文件

```bash
swagger-to-ts init -o swagger-to-ts.config.json
# 编辑配置后
swagger-to-ts generate -c swagger-to-ts.config.json
```

### 在业务代码中使用

```typescript
import { apiClient } from './src/api';

const pets = await apiClient.listPets({ limit: 10 });
```

> [!TIP]
> 生成前可先运行 `swagger-to-ts validate -i <spec>` 检查规范质量；加 `--report` 查看完整警告列表。

## 生成产物

**默认（单文件客户端）**

```
output/
├── index.ts
├── types.ts      # schema 类型 + TypedHttpClient + 拦截器类型
└── api.ts        # ApiClient + 端点方法
```

**按 tag 拆分（`splitByTag: true`）**

```
output/
├── index.ts
├── types.ts
├── api.ts        # 组合各 tag 子模块
└── modules/
    ├── user.ts
    └── order.ts
```

**仅类型（`--no-client`）**

```
output/
├── index.ts
└── types.ts
```

生成的方法签名示例：

```typescript
// GET — 泛型返回
async getUser(userId: string): Promise<Types.ApiResponseUserVO> {
  return this.http.get<Types.ApiResponseUserVO>(`/api/users/${userId}`, config);
}

// DELETE 带 body — body 通过 config.data 传递（符合 OpenAPI 规范）
async deleteBatch(data: number[]): Promise<Types.ApiResponseVoid> {
  return this.http.delete<Types.ApiResponseVoid>('/api/apis/batch', { data, ...config });
}
```

无法精确推断的类型回退为 `unknown`，松散对象映射为 `Record<string, unknown>`。

## 配置

### 支持的配置文件格式

| 格式 | 扩展名 |
|------|--------|
| JSON | `.json` |
| YAML | `.yaml`, `.yml` |
| JavaScript | `.js`, `.cjs`, `.mjs` |
| TypeScript | `.ts`, `.mts`, `.cts` |

### 单配置

```json
{
  "input": "http://10.21.1.79/bss/sysmgnt/v3/api-docs",
  "output": "./src/api/sysmgnt",
  "baseURL": "/bss/sysmgnt",
  "axiosInstance": "sysmgntApiClient",
  "generateClient": true,
  "responseWrapper": { "field": "data" },
  "splitByTag": false,
  "fetchTimeout": 60000
}
```

```typescript
import type { GeneratorConfig } from 'swagger-to-ts-axios';

const config: GeneratorConfig = {
  input: './openapi.yaml',
  output: './src/api',
  baseURL: '/api',
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

### 多配置

三种写法任选其一：

```json
[
  { "input": "./api-a.json", "output": "./src/api/a", "baseURL": "/a" },
  { "input": "./api-b.json", "output": "./src/api/b", "baseURL": "/b" }
]
```

```yaml
configs:
  - input: ./api-a.json
    output: ./src/api/a
  - input: ./api-b.json
    output: ./src/api/b
```

```bash
swagger-to-ts generate -c config-a.json,config-b.yaml
```

### 配置项参考

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `input` | `string` | — | 规范路径或 URL（必填） |
| `output` | `string` | — | 输出目录（必填） |
| `baseURL` | `string` | 从 spec 推断 | Axios `baseURL` |
| `typePrefix` | `string` | `""` | 生成类型名前缀 |
| `axiosInstance` | `string` | `apiClient` | 实例字段名 |
| `generateClient` | `boolean` | `true` | 是否生成 `api.ts` |
| `interceptors` | `object` | — | 拦截器函数字符串，嵌入生成代码 |
| `responseWrapper` | `boolean \| { field? }` | — | 解包统一响应，默认字段 `data` |
| `filterTags` | `string[]` | — | 只生成指定 tag |
| `filterPaths` | `string[]` | — | 路径过滤，支持 `*` 通配 |
| `excludeDeprecated` | `boolean` | `false` | 跳过废弃端点 |
| `splitByTag` | `boolean` | `false` | 按 tag 拆分模块 |
| `silentWarnings` | `boolean` | `true` | 解析时是否逐条打印警告 |
| `fetchTimeout` | `number` | `30000` | 远程 URL 超时（ms） |
| `insecure` | `boolean` | `false` | 关闭 TLS 校验（自签名）；HTTPS+IP 默认已跳过 hostname 校验 |

> [!TIP]
> 使用 `https://<IP>/...` 拉取时，Node/OpenSSL 要求证书含 IP SAN。本工具会对 IP 主机自动跳过 hostname 校验（仍校验 CA）。若为自签名证书，请加 `insecure: true` 或 CLI `--insecure`。

> [!NOTE]
> 命令行 `-c` 与直接传参可组合使用，CLI 选项会覆盖配置文件同名字段。

> [!IMPORTANT]
> `Authorization` 等 header 参数不会出现在生成的方法签名中，请在请求拦截器中统一注入。

## CLI

### `generate`

```bash
swagger-to-ts generate [options]
```

| 选项 | 说明 |
|------|------|
| `-i, --input <file>` | 输入文件或 URL |
| `-o, --output <dir>` | 输出目录 |
| `-b, --base-url <url>` | API 基础 URL |
| `-p, --type-prefix <prefix>` | 类型前缀 |
| `--no-client` | 只生成类型 |
| `-c, --config <paths...>` | 配置文件，可多个 |
| `--response-wrapper [field]` | 解包响应字段，默认 `data` |
| `--filter-tags <tags>` | 逗号分隔的 tag 列表 |
| `--filter-paths <paths>` | 逗号分隔的路径，支持 `*` |
| `--exclude-deprecated` | 排除废弃端点 |
| `--split-by-tag` | 按 tag 拆分 |
| `--fetch-timeout <ms>` | 远程拉取超时 |
| `--insecure` | 关闭 TLS 校验（自签名证书） |
| `--silent-warnings` | 解析时不逐条打印警告 |

### `init`

```bash
swagger-to-ts init -o swagger-to-ts.config.ts --multi
```

### `validate`

```bash
swagger-to-ts validate -i ./swagger.json
swagger-to-ts validate -i https://example.com/v3/api-docs --report
```

## 编程调用

```typescript
import {
  generateFromSwagger,
  createDefaultConfig,
  loadConfigFiles,
  SwaggerParser,
  loadSpec
} from 'swagger-to-ts-axios';

// 直接生成
await generateFromSwagger(
  createDefaultConfig('./swagger.json', './src/api')
);

// 批量配置
for (const cfg of await loadConfigFiles(['swagger-to-ts.config.ts'])) {
  await generateFromSwagger(cfg);
}

// 仅解析
const parser = await SwaggerParser.fromInput('https://example.com/v3/api-docs');
console.log(parser.getApiEndpoints().length);
```

| 导出 | 用途 |
|------|------|
| `generateFromSwagger` | 执行代码生成 |
| `createDefaultConfig` | 创建默认配置 |
| `loadConfigFiles` / `loadConfigFile` | 加载配置文件 |
| `loadSpec` / `validateSpecStructure` | 加载与校验规范 |
| `SwaggerParser` | 解析端点与类型 |
| `TypeScriptGenerator` | 底层生成器 |
| `filterEndpoints` | 端点过滤 |

## 常见场景

### 统一响应解包

后端返回 `{ code, data, message }`：

```bash
swagger-to-ts generate -i ./swagger.json -o ./src/api --response-wrapper data
```

方法返回类型自动推断为 `data` 内层类型，默认拦截器返回解包后的值。

### 自定义客户端

```typescript
import { ApiClient, ApiError } from './src/api';

const client = new ApiClient({
  baseURL: '/api',
  interceptors: {
    request: {
      onFulfilled: (config) => {
        config.headers.Authorization = `Bearer ${getToken()}`;
        return config;
      }
    }
  }
});

try {
  await client.getUser('id');
} catch (e) {
  const err = e as ApiError;
  console.error(err.status, err.message);
}
```

### 按 tag 拆分后调用

```typescript
import { apiClient } from './src/api';

await apiClient.user.list();
await apiClient.order.create(data);
```

## 规范支持

| 特性 | Swagger 2.0 | OpenAPI 3.0 |
|------|:-----------:|:-----------:|
| 基本类型 / 枚举 | ✓ | ✓ |
| `$ref` 引用 | ✓ | ✓ |
| path / query / body 参数 | ✓ | ✓ |
| multipart / formData | ✓ | ✓ |
| `oneOf` / `anyOf` / `allOf` | — | ✓ |
| `discriminator` 判别联合 | — | ✓ |
| `nullable` | — | ✓ |
| `deprecated` → `@deprecated` | ✓ | ✓ |
| DELETE / GET 带 requestBody | — | ✓ |

## 开发

```bash
git clone https://github.com/Aii-Group/Swagger-To-TS.git
cd Swagger-To-TS
npm install

npm run typecheck    # 严格类型检查（含测试）
npm test             # 单元测试（含生成代码 strict 校验）
npm run build        # 构建 CJS + ESM

# 本地调试
node dist/cjs/cli.js generate -i ./spec.json -o ./out
node dist/cjs/cli.js validate -i ./spec.json --report
```

构建产物：`dist/cjs`（CommonJS）与 `dist/esm`（ES Module），通过 `package.json exports` 双格式导出。
