// 自动生成的类型定义文件
// 请勿手动修改此文件

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export type Pet = any;

export interface NewPet {
  name: string;
  tag?: string;
  status?: 'available' | 'pending' | 'sold';
}

export interface Error {
  code: number;
  message: string;
}
