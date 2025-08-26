/**
 * 拦截器使用示例
 * 展示如何在实际项目中使用自定义拦截器
 */

import { ApiClient } from './src/api/api';

// 示例1: 认证拦截器
export function createAuthenticatedClient(token: string) {
  return new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    interceptors: {
      request: {
        onFulfilled: (config) => {
          // 自动添加认证头
          config.headers.Authorization = `Bearer ${token}`;
          return config;
        },
        onRejected: (error) => {
          console.error('认证请求失败:', error);
          return Promise.reject(error);
        }
      },
      response: {
        onFulfilled: (response) => response,
        onRejected: (error) => {
          // 处理认证失败
          if (error.response?.status === 401) {
            console.warn('认证失败，请重新登录');
            // 可以触发重新登录逻辑
            // window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }
    }
  });
}

// 示例2: 日志记录拦截器
export function createLoggingClient() {
  return new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    interceptors: {
      request: {
        onFulfilled: (config) => {
          // 记录请求开始时间
          config.metadata = { 
            startTime: Date.now(),
            requestId: Math.random().toString(36).substr(2, 9)
          };
          
          console.log(`🚀 [${config.metadata.requestId}] 发送请求:`, {
            method: config.method?.toUpperCase(),
            url: config.url,
            params: config.params,
            data: config.data
          });
          
          return config;
        }
      },
      response: {
        onFulfilled: (response) => {
          const duration = Date.now() - response.config.metadata?.startTime;
          const requestId = response.config.metadata?.requestId;
          
          console.log(`✅ [${requestId}] 请求成功 (${duration}ms):`, {
            status: response.status,
            statusText: response.statusText,
            dataSize: JSON.stringify(response.data).length
          });
          
          return response;
        },
        onRejected: (error) => {
          const duration = Date.now() - error.config?.metadata?.startTime;
          const requestId = error.config?.metadata?.requestId;
          
          console.error(`❌ [${requestId}] 请求失败 (${duration}ms):`, {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message
          });
          
          return Promise.reject(error);
        }
      }
    }
  });
}

// 示例3: 缓存拦截器
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5分钟缓存

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

export function createCachedClient() {
  const cache = new SimpleCache();
  
  return new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    interceptors: {
      request: {
        onFulfilled: (config) => {
          // 只缓存 GET 请求
          if (config.method?.toLowerCase() === 'get') {
            const cacheKey = `${config.url}?${JSON.stringify(config.params || {})}`;
            const cachedData = cache.get(cacheKey);
            
            if (cachedData) {
              console.log('🎯 使用缓存数据:', cacheKey);
              // 返回缓存的响应
              return Promise.resolve({
                data: cachedData,
                status: 200,
                statusText: 'OK (Cached)',
                headers: {},
                config,
                request: {}
              } as any);
            }
            
            config.metadata = { ...config.metadata, cacheKey };
          }
          
          return config;
        }
      },
      response: {
        onFulfilled: (response) => {
          // 缓存 GET 请求的响应
          if (response.config.method?.toLowerCase() === 'get' && response.config.metadata?.cacheKey) {
            cache.set(response.config.metadata.cacheKey, response.data);
            console.log('💾 缓存响应数据:', response.config.metadata.cacheKey);
          }
          
          return response;
        }
      }
    }
  });
}

// 示例4: 重试拦截器
export function createRetryClient(maxRetries = 3) {
  return new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    interceptors: {
      response: {
        onFulfilled: (response) => response,
        onRejected: async (error) => {
          const config = error.config;
          
          // 初始化重试计数
          if (!config.__retryCount) {
            config.__retryCount = 0;
          }
          
          // 检查是否应该重试
          const shouldRetry = 
            config.__retryCount < maxRetries &&
            error.response?.status >= 500; // 只重试服务器错误
          
          if (shouldRetry) {
            config.__retryCount++;
            
            console.log(`🔄 重试请求 (${config.__retryCount}/${maxRetries}):`, config.url);
            
            // 指数退避延迟
            const delay = Math.pow(2, config.__retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 重新发送请求
            const tempClient = new ApiClient({ baseURL: 'https://petstore.swagger.io/api' });
            return (tempClient as any).apiClient.request(config);
          }
          
          return Promise.reject(error);
        }
      }
    }
  });
}

// 示例5: 请求限流拦截器
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests = 10, timeWindowMs = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    
    // 清理过期的请求记录
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      console.log(`⏳ 请求限流，等待 ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      return this.checkLimit(); // 递归检查
    }
    
    this.requests.push(now);
  }
}

export function createRateLimitedClient(maxRequests = 10, timeWindowMs = 60000) {
  const rateLimiter = new RateLimiter(maxRequests, timeWindowMs);
  
  return new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    interceptors: {
      request: {
        onFulfilled: async (config) => {
          await rateLimiter.checkLimit();
          return config;
        }
      }
    }
  });
}

// 使用示例
export async function demonstrateInterceptors() {
  console.log('=== 拦截器使用示例 ===\n');
  
  // 1. 认证客户端示例
  console.log('1. 认证客户端示例:');
  const authClient = createAuthenticatedClient('your-jwt-token-here');
  try {
    const pets = await authClient.findPets({ limit: 3 });
    console.log('认证请求成功，获取到宠物数量:', pets.data?.length || 0);
  } catch (error) {
    console.log('认证请求失败:', error.message);
  }
  
  console.log('\n2. 日志记录客户端示例:');
  const loggingClient = createLoggingClient();
  try {
    await loggingClient.findPets({ limit: 2 });
  } catch (error) {
    console.log('日志记录请求处理完成');
  }
  
  console.log('\n3. 缓存客户端示例:');
  const cachedClient = createCachedClient();
  try {
    // 第一次请求
    await cachedClient.findPets({ limit: 2 });
    // 第二次请求（应该使用缓存）
    await cachedClient.findPets({ limit: 2 });
  } catch (error) {
    console.log('缓存请求处理完成');
  }
  
  console.log('\n4. 重试客户端示例:');
  const retryClient = createRetryClient(2);
  try {
    // 这个请求可能会失败并重试
    await retryClient.findPetById(99999);
  } catch (error) {
    console.log('重试请求最终失败:', error.message);
  }
  
  console.log('\n5. 限流客户端示例:');
  const rateLimitedClient = createRateLimitedClient(3, 10000); // 10秒内最多3个请求
  try {
    // 快速发送多个请求，观察限流效果
    const promises = Array.from({ length: 5 }, (_, i) => 
      rateLimitedClient.findPets({ limit: 1 })
    );
    await Promise.all(promises);
  } catch (error) {
    console.log('限流请求处理完成');
  }
  
  console.log('\n=== 所有示例执行完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  demonstrateInterceptors().catch(console.error);
}