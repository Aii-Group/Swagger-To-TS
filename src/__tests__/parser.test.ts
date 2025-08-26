import { SwaggerParser } from '../parser';
import { SwaggerSpec } from '../types';

// 测试用的简单 Swagger 规范
const mockSwaggerSpec: SwaggerSpec = {
  swagger: '2.0',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths: {
    '/users': {
      get: {
        operationId: 'getUsers',
        summary: 'Get all users',
        responses: {
          '200': {
            description: 'Success',
            schema: {
              type: 'array',
              items: {
                $ref: '#/definitions/User'
              }
            }
          }
        }
      },
      post: {
        operationId: 'createUser',
        summary: 'Create user',
        parameters: [
          {
            name: 'user',
            in: 'body',
            required: true,
            schema: {
              $ref: '#/definitions/NewUser'
            }
          }
        ],
        responses: {
          '201': {
            description: 'Created',
            schema: {
              $ref: '#/definitions/User'
            }
          }
        }
      }
    },
    '/users/{id}': {
      get: {
        operationId: 'getUserById',
        summary: 'Get user by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: 'integer'
          }
        ],
        responses: {
          '200': {
            description: 'Success',
            schema: {
              $ref: '#/definitions/User'
            }
          }
        }
      }
    }
  },
  definitions: {
    User: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: {
          type: 'integer',
          description: 'User ID'
        },
        name: {
          type: 'string',
          description: 'User name'
        },
        email: {
          type: 'string',
          description: 'User email'
        }
      }
    },
    NewUser: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: 'User name'
        },
        email: {
          type: 'string',
          description: 'User email'
        }
      }
    }
  }
};

describe('SwaggerParser', () => {
  let parser: SwaggerParser;

  beforeEach(() => {
    parser = new SwaggerParser(mockSwaggerSpec);
  });

  describe('getApiEndpoints', () => {
    it('should parse API endpoints correctly', () => {
      const endpoints = parser.getApiEndpoints();
      
      expect(endpoints).toHaveLength(3);
      
      // 检查 GET /users
      const getUsersEndpoint = endpoints.find(e => e.path === '/users' && e.method === 'GET');
      expect(getUsersEndpoint).toBeDefined();
      expect(getUsersEndpoint?.operationId).toBe('getUsers');
      expect(getUsersEndpoint?.summary).toBe('Get all users');
      
      // 检查 POST /users
      const createUserEndpoint = endpoints.find(e => e.path === '/users' && e.method === 'POST');
      expect(createUserEndpoint).toBeDefined();
      expect(createUserEndpoint?.operationId).toBe('createUser');
      expect(createUserEndpoint?.parameters).toHaveLength(0); // body 参数不在 parameters 中
      expect(createUserEndpoint?.requestBody).toBeDefined(); // body 参数在 requestBody 中
      expect(createUserEndpoint?.requestBody?.type).toBe('NewUser');
      
      // 检查 GET /users/{id}
      const getUserByIdEndpoint = endpoints.find(e => e.path === '/users/{id}' && e.method === 'GET');
      expect(getUserByIdEndpoint).toBeDefined();
      expect(getUserByIdEndpoint?.parameters).toHaveLength(1);
      expect(getUserByIdEndpoint?.parameters[0].name).toBe('id');
      expect(getUserByIdEndpoint?.parameters[0].in).toBe('path');
    });
  });

  describe('getTypeDefinitions', () => {
    it('should parse type definitions correctly', () => {
      const types = parser.getTypeDefinitions();
      
      expect(types).toHaveLength(2);
      
      // 检查 User 类型
      const userType = types.find(t => t.name === 'User');
      expect(userType).toBeDefined();
      expect(userType?.type).toBe('interface');
      expect(userType?.properties).toBeDefined();
      expect(Object.keys(userType?.properties || {})).toHaveLength(3);
      
      // 检查 NewUser 类型
      const newUserType = types.find(t => t.name === 'NewUser');
      expect(newUserType).toBeDefined();
      expect(newUserType?.type).toBe('interface');
    });
  });

  describe('getBaseUrl', () => {
    it('should return default base URL for Swagger 2.0', () => {
      const baseUrl = parser.getBaseUrl();
      expect(baseUrl).toBe('https://localhost');
    });
  });

  describe('resolveType', () => {
    it('should resolve basic types correctly', () => {
      // 这里需要访问私有方法，在实际测试中可能需要重构
      // 或者通过公共方法间接测试
      const endpoints = parser.getApiEndpoints();
      const getUserEndpoint = endpoints.find(e => e.operationId === 'getUserById');
      
      expect(getUserEndpoint?.parameters[0].type).toBe('number');
    });
  });
});