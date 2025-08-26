# Swagger to TypeScript Axios

🚀 从 Swagger/OpenAPI 规范自动生成 TypeScript 接口定义和类型安全的 Axios API 客户端。

## ✨ 特性

- 📝 **自动生成 TypeScript 接口** - 从 Swagger/OpenAPI 规范生成完整的类型定义
- 🔒 **类型安全的 API 客户端** - 基于 Axios 的类型安全 HTTP 客户端
- 🎯 **智能类型推导** - 完整的 TypeScript 类型推导支持
- 🛠️ **命令行工具** - 简单易用的 CLI 工具
- 📦 **零配置使用** - 开箱即用，也支持自定义配置
- 🔄 **支持多种格式** - 同时支持 Swagger 2.0 和 OpenAPI 3.0
- ⚡ **高性能** - 优化的代码生成和运行时性能

## 📦 安装

```bash
# 全局安装
npm install -g swagger-to-ts-axios

# 或者作为项目依赖
npm install swagger-to-ts-axios
```

## 🚀 快速开始

### 命令行使用

#### 使用命令行参数

```bash
# 从本地文件生成
swagger-to-ts generate -i ./swagger.json -o ./src/api

# 从远程 URL 生成
swagger-to-ts generate -i https://petstore.swagger.io/v2/swagger.json -o ./src/api

# 指定 API 基础 URL
swagger-to-ts generate -i ./swagger.json -o ./src/api -b https://api.example.com

# 添加类型前缀
swagger-to-ts generate -i ./swagger.json -o ./src/api -p "Api"

# 只生成类型，不生成客户端
swagger-to-ts generate -i ./swagger.json -o ./src/api --no-client
```

#### 使用配置文件

1. 创建配置文件：

```bash
swagger-to-ts init -o swagger-to-ts.config.json
```

2. 编辑配置文件：

```json
{
  "input": "https://your-api.com/swagger.json",
  "output": "./src/api",
  "baseURL": "/api",
  "typePrefix": "",
  "axiosInstance": "apiClient",
  "generateClient": true
}
```

3. 使用配置文件生成代码：

```bash
swagger-to-ts generate -c swagger-to-ts.config.json
```

### 编程方式使用

```typescript
import { generateFromSwagger, createDefaultConfig } from 'swagger-to-ts-axios';

async function generateApi() {
  const config = createDefaultConfig('./swagger.json', './src/api');
  
  // 自定义配置
  config.baseURL = 'https://api.example.com';
  config.typePrefix = 'Api';
  
  await generateFromSwagger(config);
  console.log('API 代码生成完成！');
}

generateApi();
```

## 📋 命令行选项

### `generate` 命令

生成 TypeScript 代码

```bash
swagger-to-ts generate [options]
```

**选项：**

- `-i, --input <file>` - Swagger/OpenAPI 文件路径或 URL (必需)
- `-o, --output <dir>` - 输出目录 (必需)
- `-b, --base-url <url>` - API 基础 URL
- `-p, --type-prefix <prefix>` - 类型前缀
- `--no-client` - 不生成 API 客户端
- `-c, --config <file>` - 配置文件路径

### `init` 命令

创建配置文件模板

```bash
swagger-to-ts init [options]
```

**选项：**

- `-o, --output <file>` - 配置文件输出路径 (默认: swagger-to-ts.config.json)

### `validate` 命令

验证 Swagger/OpenAPI 文件

```bash
swagger-to-ts validate -i <file>
# 或验证远程文件
swagger-to-ts validate -i https://petstore.swagger.io/v2/swagger.json
```

## ⚙️ 配置文件

使用 `swagger-to-ts init` 创建配置文件模板：

```json
{
  "input": "./swagger.json",
  "output": "./src/api",
  "baseURL": "https://api.example.com",
  "typePrefix": "",
  "axiosInstance": "apiClient",
  "generateClient": true
}
```

**配置选项说明：**

- `input` - Swagger/OpenAPI 文件路径或 URL
- `output` - 输出目录
- `baseURL` - API 基础 URL (可选)
- `typePrefix` - 生成的类型前缀 (可选)
- `axiosInstance` - Axios 实例名称 (默认: apiClient)
- `generateClient` - 是否生成 API 客户端 (默认: true)
- `interceptors` - 默认拦截器配置 (可选)

### 拦截器配置示例

```json
{
  "input": "./swagger.json",
  "output": "./src/api",
  "baseURL": "https://api.example.com",
  "interceptors": {
    "request": {
      "onFulfilled": "(config) => { config.headers['X-API-Key'] = 'your-api-key'; return config; }",
      "onRejected": "(error) => Promise.reject(error)"
    },
    "response": {
      "onFulfilled": "(response) => response",
      "onRejected": "(error) => { console.error('API Error:', error); return Promise.reject(error); }"
    }
  }
}
```

**注意**: 配置文件中的拦截器函数需要以字符串形式提供，生成的代码会将其转换为实际的函数。

## 📁 生成的文件结构

```
src/api/
├── index.ts      # 入口文件
├── types.ts      # 类型定义
└── api.ts        # API 客户端 (如果启用)
```

## 💡 使用示例

### 1. 基本使用

```typescript
import { apiClient, Pet, NewPet } from './src/api';

// 获取所有宠物
const pets = await apiClient.listPets({ limit: 10 });
console.log(pets.data); // 类型: Pet[]

// 创建新宠物
const newPet: NewPet = {
  name: '小白',
  status: 'available'
};

const createdPet = await apiClient.createPet(newPet);
console.log(createdPet.data); // 类型: Pet
```

### 2. 自定义客户端配置

```typescript
import { ApiClient } from './src/api';

// 创建带有自定义配置的客户端
const customClient = new ApiClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});

// 使用自定义客户端
const response = await customClient.listPets();
```

### 3. 自定义拦截器

生成的 API 客户端支持自定义请求和响应拦截器：

```typescript
import { ApiClient } from './src/api';

// 方式1：在构造函数中配置拦截器
const clientWithInterceptors = new ApiClient({
  baseURL: 'https://api.example.com',
  interceptors: {
    request: {
      onFulfilled: (config) => {
        // 添加认证头
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('发送请求:', config.url);
        return config;
      },
      onRejected: (error) => {
        console.error('请求错误:', error);
        return Promise.reject(error);
      }
    },
    response: {
      onFulfilled: (response) => {
        console.log('收到响应:', response.status);
        return response;
      },
      onRejected: (error) => {
        // 统一错误处理
        if (error.response?.status === 401) {
          // 处理未授权错误
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
  }
});

// 方式2：动态设置拦截器
const client = new ApiClient({ baseURL: 'https://api.example.com' });

// 设置请求拦截器
client.setRequestInterceptor(
  (config) => {
    config.headers['X-Request-ID'] = generateRequestId();
    return config;
  },
  (error) => Promise.reject(error)
);

// 设置响应拦截器
client.setResponseInterceptor(
  (response) => response.data, // 直接返回数据部分
  (error) => {
    // 错误日志记录
    console.error('API Error:', error.response?.data);
    return Promise.reject(error);
  }
);

// 清除所有拦截器
client.clearInterceptors();
```

### 4. 错误处理

```typescript
try {
  const pet = await apiClient.showPetById(123);
  console.log(pet.data);
} catch (error) {
  // 类型安全的错误处理
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as { status?: number; message: string };
    console.error(`API 错误 ${apiError.status}: ${apiError.message}`);
  }
}
```

## 🔧 高级用法

### 类型扩展

```typescript
// 扩展生成的类型
import { Pet as GeneratedPet } from './src/api';

interface ExtendedPet extends GeneratedPet {
  // 添加自定义属性
  customField?: string;
  computedProperty: string;
}

// 使用扩展类型
const pet: ExtendedPet = {
  id: 1,
  name: '小白',
  status: 'available',
  computedProperty: 'computed value'
};
```

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 🛠️ 开发

```bash
# 克隆项目
git clone https://github.com/Aii-Group/Swagger-To-TS.git
cd swagger-to-ts-axios

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 📝 支持的 Swagger/OpenAPI 特性

### Swagger 2.0
- ✅ 基本类型 (string, number, boolean, array, object)
- ✅ 引用类型 ($ref)
- ✅ 枚举类型
- ✅ 路径参数
- ✅ 查询参数
- ✅ 请求体
- ✅ 响应类型
- ✅ 标签分组

### OpenAPI 3.0
- ✅ 基本类型支持
- ✅ Components/Schemas
- ✅ RequestBody
- ✅ 多服务器支持
- ✅ 媒体类型

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Swagger/OpenAPI](https://swagger.io/) - API 规范标准
- [Axios](https://axios-http.com/) - HTTP 客户端库
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript
- [Commander.js](https://github.com/tj/commander.js/) - 命令行工具框架

## 📞 支持

如果你遇到问题或有建议，请：

- 📋 [提交 Issue](https://github.com/Aii-Group/Swagger-To-TS/issues)
- 💬 [参与讨论](https://github.com/Aii-Group/Swagger-To-TS/discussions)
- 📧 发送邮件到 aii_group@163.com

---

⭐ 如果这个项目对你有帮助，请给它一个星标！