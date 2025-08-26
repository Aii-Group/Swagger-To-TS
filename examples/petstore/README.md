# Petstore API 示例

这个示例项目展示了如何使用 `swagger-to-ts-axios` 工具从 Swagger/OpenAPI 规范生成 TypeScript API 客户端，并在实际项目中使用。

## 📁 项目结构

```
petstore/
├── swagger.json                    # Swagger 2.0 规范文件
├── openapi.yaml                    # OpenAPI 3.0 规范文件
├── swagger-to-ts.config.json       # 代码生成配置文件
├── package.json                    # 项目依赖配置
├── tsconfig.json                   # TypeScript 配置
├── interceptor-examples.ts         # 拦截器使用示例
├── src/
│   ├── api/                        # 生成的 API 代码
│   │   ├── index.ts               # 入口文件
│   │   ├── types.ts               # 类型定义
│   │   └── api.ts                 # API 客户端
│   ├── index.ts                   # Node.js 使用示例
│   ├── PetList.tsx                # React 组件示例（仅供参考）
│   └── browser-example.js         # 浏览器环境示例
├── public/
│   └── index.html                 # HTML 示例页面
└── README.md                      # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
# 进入示例目录
cd examples/petstore

# 安装依赖
npm install
```

### 2. 生成 API 代码

```bash
# 使用配置文件生成代码
npm run generate

# 或者直接使用命令行
swagger-to-ts generate -c swagger-to-ts.config.json
```

### 3. 运行示例

```bash
# 编译 TypeScript
npm run build

# 运行 Node.js 示例
npm start

# 或者直接运行 TypeScript（需要 ts-node）
npm run dev
```

## 📋 示例说明

### Node.js 示例 (`src/index.ts`)

这个文件展示了在 Node.js 环境中如何使用生成的 API 客户端：

- **基本使用**: 获取宠物列表、创建宠物、根据ID查询宠物
- **自定义客户端**: 创建带有自定义配置的 API 客户端
- **错误处理**: 演示如何处理 API 调用错误
- **类型安全**: 展示 TypeScript 的类型检查功能

```typescript
import { apiClient, NewPet } from './api';

// 获取宠物列表
const pets = await apiClient.findPets({ limit: 10 });

// 创建新宠物
const newPet: NewPet = {
  name: '小白',
  status: 'available'
};
const created = await apiClient.addPet(newPet);
```

### 浏览器示例 (`public/index.html` + `src/browser-example.js`)

这个示例展示了在浏览器环境中的使用方法：

- 完整的宠物管理界面
- 添加、删除、查看宠物功能
- 错误处理和加载状态显示
- 响应式设计

要运行浏览器示例：

1. 启动一个本地服务器（如 `python -m http.server` 或 `npx serve`）
2. 在浏览器中打开 `public/index.html`

### React 组件示例 (`src/PetList.tsx`)

这是一个 React 组件示例，展示了如何在 React 应用中使用 API 客户端：

- 使用 React Hooks 管理状态
- 异步数据获取和错误处理
- 类型安全的组件属性和状态

**注意**: 这个文件仅供参考，需要安装 React 相关依赖才能正常使用。

### 拦截器示例 (`interceptor-examples.ts`)

这个文件提供了完整的拦截器使用示例，包括：

- **认证拦截器**: 自动添加 Authorization 头部
- **日志拦截器**: 记录请求和响应信息
- **缓存拦截器**: 实现简单的响应缓存机制
- **重试拦截器**: 自动重试失败的请求
- **限流拦截器**: 控制请求频率

```typescript
// 运行拦截器示例
npx ts-node interceptor-examples.ts
```

每个示例都展示了不同的拦截器配置方式和实际应用场景。

## ⚙️ 配置说明

### swagger-to-ts.config.json

```json
{
  "input": "./swagger.json",           // 输入的 Swagger 文件
  "output": "./src/api",               // 输出目录
  "baseURL": "https://petstore.swagger.io/api", // API 基础 URL
  "typePrefix": "",                   // 类型前缀
  "axiosInstance": "apiClient",       // Axios 实例名称
  "generateClient": true              // 是否生成客户端代码
}
```

### package.json 脚本

- `npm run generate` - 生成 API 代码
- `npm run build` - 编译 TypeScript
- `npm start` - 运行编译后的代码
- `npm run dev` - 直接运行 TypeScript 代码

## 🔧 生成的代码说明

### types.ts

包含所有的 TypeScript 接口定义：

```typescript
export interface Pet {
  id?: number;
  name: string;
  status?: 'available' | 'pending' | 'sold';
}

export interface NewPet {
  name: string;
  tag?: string;
  status?: 'available' | 'pending' | 'sold';
}
```

### api.ts

包含 API 客户端类和方法：

```typescript
export class ApiClient {
  // 获取宠物列表
  async findPets(params?: { tags?: any[]; limit?: number }): Promise<ApiResponse<Pet[]>>
  
  // 添加新宠物
  async addPet(data: NewPet): Promise<ApiResponse<Pet>>
  
  // 根据ID获取宠物
  async findPetById(id: number): Promise<ApiResponse<Pet>>
  
  // 删除宠物
  async deletePet(id: number): Promise<ApiResponse<void>>
}
```

### index.ts

入口文件，导出所有类型和 API 客户端：

```typescript
export * from './types';
export * from './api';
```

## 🌟 特性展示

### 1. 类型安全

```typescript
// ✅ 正确的类型
const pet: NewPet = {
  name: '小白',
  status: 'available' // 只能是 'available' | 'pending' | 'sold'
};

// ❌ TypeScript 会报错
// pet.status = 'invalid'; // 类型错误
// pet.unknownField = 'value'; // 属性不存在
```

### 2. 智能提示

IDE 会提供完整的代码补全和参数提示。

### 3. 错误处理

```typescript
try {
  const pet = await apiClient.findPetById(123);
} catch (error: any) {
  console.log('API 错误:', error.message);
  console.log('状态码:', error.status);
}
```

### 4. 自定义配置

```typescript
const customClient = new ApiClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

### 5. 自定义拦截器

生成的 API 客户端支持自定义请求和响应拦截器：

```typescript
import { ApiClient } from './api';

// 方式1：在构造函数中配置拦截器
const clientWithInterceptors = new ApiClient({
  baseURL: 'https://petstore.swagger.io/api',
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
        // 可以直接返回数据部分
        return response.data ? { ...response, data: response.data } : response;
      },
      onRejected: (error) => {
        // 统一错误处理
        if (error.response?.status === 401) {
          console.log('未授权，请重新登录');
          // 可以跳转到登录页面
        }
        return Promise.reject(error);
      }
    }
  }
});

// 方式2：动态设置拦截器
const client = new ApiClient({ baseURL: 'https://petstore.swagger.io/api' });

// 设置请求拦截器
client.setRequestInterceptor(
  (config) => {
    config.headers['X-Request-ID'] = Date.now().toString();
    config.headers['X-Client-Version'] = '1.0.0';
    return config;
  },
  (error) => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 设置响应拦截器
client.setResponseInterceptor(
  (response) => {
    // 记录响应时间
    console.log(`API 响应时间: ${Date.now() - response.config.metadata?.startTime}ms`);
    return response;
  },
  (error) => {
    // 错误日志记录
    console.error('API 错误:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// 清除所有拦截器
client.clearInterceptors();
```

### 6. 拦截器实际应用示例

```typescript
// 创建带有完整拦截器配置的客户端
const petStoreClient = new ApiClient({
  baseURL: 'https://petstore.swagger.io/api',
  timeout: 10000,
  interceptors: {
    request: {
      onFulfilled: (config) => {
        // 添加时间戳
        config.metadata = { startTime: Date.now() };
        
        // 添加 API Key（如果需要）
        if (process.env.API_KEY) {
          config.headers['X-API-Key'] = process.env.API_KEY;
        }
        
        // 请求日志
        console.log(`🚀 发送 ${config.method?.toUpperCase()} 请求到: ${config.url}`);
        
        return config;
      }
    },
    response: {
      onFulfilled: (response) => {
        // 响应时间计算
        const duration = Date.now() - response.config.metadata?.startTime;
        console.log(`✅ 请求成功 (${duration}ms):`, response.status);
        
        return response;
      },
      onRejected: (error) => {
        // 详细错误处理
        const duration = Date.now() - error.config?.metadata?.startTime;
        console.error(`❌ 请求失败 (${duration}ms):`, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        
        // 根据错误类型进行不同处理
        if (error.response?.status === 404) {
          console.warn('资源未找到');
        } else if (error.response?.status >= 500) {
          console.error('服务器错误，请稍后重试');
        }
        
        return Promise.reject(error);
      }
    }
  }
});

// 使用配置好的客户端
async function demonstrateInterceptors() {
  try {
    // 这些请求都会经过拦截器处理
    const pets = await petStoreClient.findPets({ limit: 5 });
    console.log('获取到宠物列表:', pets.data);
    
    const newPet = await petStoreClient.addPet({
      name: '小白',
      status: 'available'
    });
    console.log('创建新宠物:', newPet.data);
    
  } catch (error) {
    console.error('操作失败:', error);
  }
}
```

## 🔄 使用不同的 Swagger 文件

这个示例包含两个规范文件：

1. **swagger.json** - Swagger 2.0 格式
2. **openapi.yaml** - OpenAPI 3.0 格式

要使用 OpenAPI 3.0 文件，修改配置：

```json
{
  "input": "./openapi.yaml",
  "output": "./src/api"
}
```

## 🛠️ 自定义和扩展

### 扩展生成的类型

```typescript
import { Pet as GeneratedPet } from './api/types';

interface ExtendedPet extends GeneratedPet {
  customField?: string;
  computedProperty: string;
}
```

### 添加拦截器

```typescript
import { apiClient } from './api';

// 添加请求拦截器
apiClient.setRequestInterceptor((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});
```

## 📚 相关资源

- [Swagger/OpenAPI 规范](https://swagger.io/specification/)
- [Axios 文档](https://axios-http.com/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

## 🤝 贡献

如果你发现问题或有改进建议，欢迎提交 Issue 或 Pull Request。

## 📄 许可证

本示例项目基于 MIT 许可证。