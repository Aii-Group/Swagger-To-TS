// 自动生成的 API 客户端文件
// 请勿手动修改此文件

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as Types from './types';

// 拦截器配置接口
export interface ApiClientConfig extends AxiosRequestConfig {
  baseURL?: string;
  interceptors?: Types.InterceptorConfig;
}

export class ApiClient {
  private apiClient: AxiosInstance;

  constructor(config: ApiClientConfig = {}) {
    const { baseURL = 'https://petstore.swagger.io/api', interceptors, ...axiosConfig } = config;

    this.apiClient = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...axiosConfig,
    });

    this.setupInterceptors(interceptors);
  }

  private setupInterceptors(interceptors?: Types.InterceptorConfig) {
    // 请求拦截器
    const requestOnFulfilled = interceptors?.request?.onFulfilled || ((config) => config);
    const requestOnRejected = interceptors?.request?.onRejected || ((error) => Promise.reject(error));
    this.apiClient.interceptors.request.use(requestOnFulfilled, requestOnRejected);

    // 响应拦截器
    const responseOnFulfilled = interceptors?.response?.onFulfilled || ((response) => response);
    const responseOnRejected = interceptors?.response?.onRejected || ((error) => {
      const apiError: Types.ApiError = {
        message: error.message,
        status: error.response?.status,
        code: error.code,
      };
      return Promise.reject(apiError);
    });
    this.apiClient.interceptors.response.use(responseOnFulfilled, responseOnRejected);
  }

  // 动态设置拦截器的方法
  setRequestInterceptor(interceptor: Types.RequestInterceptor) {
    this.apiClient.interceptors.request.use(
      interceptor.onFulfilled || ((config) => config),
      interceptor.onRejected || ((error) => Promise.reject(error))
    );
  }

  setResponseInterceptor(interceptor: Types.ResponseInterceptor) {
    this.apiClient.interceptors.response.use(
      interceptor.onFulfilled || ((response) => response),
      interceptor.onRejected || ((error) => Promise.reject(error))
    );
  }

  // 清除所有拦截器
  clearInterceptors() {
    this.apiClient.interceptors.request.clear();
    this.apiClient.interceptors.response.clear();
    // 重新设置默认拦截器
    this.setupInterceptors();
  }

  /**
   * Returns all pets from the system that the user has access to
   */
  async findPets(params?: { tags?: any[]; limit?: number }, config?: AxiosRequestConfig): Promise<Types.ApiResponse<Types.Pet[]>> {
    return this.apiClient.get('/pets', { params, ...config });
  }

  /**
   * Creates a new pet in the store
   */
  async addPet(data: Types.NewPet, config?: AxiosRequestConfig): Promise<Types.ApiResponse<Types.Pet>> {
    return this.apiClient.post('/pets', data, { ...config });
  }

  /**
   * Returns a user based on a single ID, if the user does not have access to the pet
   */
  async findPetById(id: number, config?: AxiosRequestConfig): Promise<Types.ApiResponse<Types.Pet>> {
    return this.apiClient.get('/pets/${id}', { ...config });
  }

  /**
   * deletes a single pet based on the ID supplied
   */
  async deletePet(id: number, config?: AxiosRequestConfig): Promise<Types.ApiResponse<void>> {
    return this.apiClient.delete('/pets/${id}', { ...config });
  }

}

// 默认导出实例
export const apiClient = new ApiClient();

export default apiClient;