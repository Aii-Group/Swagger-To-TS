// 自动生成的 API 客户端文件
// 请勿手动修改此文件

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as Types from './types';

export class ApiClient {
  private apiClient: AxiosInstance;

  constructor(baseURL: string = 'https://petstore.swagger.io/api', config?: AxiosRequestConfig) {
    this.apiClient = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    });

    // 请求拦截器
    this.apiClient.interceptors.request.use(
      (config) => config,
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError: Types.ApiError = {
          message: error.message,
          status: error.response?.status,
          code: error.code,
        };
        return Promise.reject(apiError);
      }
    );
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