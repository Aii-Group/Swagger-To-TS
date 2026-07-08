import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { TypeScriptGenerator } from '../generator';
import { SwaggerParser } from '../parser';
import { SwaggerSpec } from '../types';

const mockSpec: SwaggerSpec = {
  swagger: '2.0',
  info: { title: 'Prefix Test API', version: '1.0.0' },
  paths: {
    '/users/{id}': {
      get: {
        operationId: 'getUserById',
        parameters: [
          { name: 'id', in: 'path', required: true, type: 'integer' }
        ],
        responses: {
          '200': {
            description: 'Success',
            schema: { $ref: '#/definitions/User' }
          }
        }
      }
    }
  },
  definitions: {
    User: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' }
      }
    }
  }
};

describe('TypeScriptGenerator typePrefix', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-to-ts-'));
  });

  afterEach(async () => {
    await fs.remove(outputDir);
  });

  it('should keep types.ts exports and api.ts references in sync when typePrefix is set', async () => {
    const parser = new SwaggerParser(mockSpec);
    const generator = new TypeScriptGenerator(
      {
        input: './swagger.json',
        output: outputDir,
        typePrefix: 'Api',
        generateClient: true,
        axiosInstance: 'apiClient'
      },
      parser
    );

    await generator.generate();

    const typesContent = await fs.readFile(path.join(outputDir, 'types.ts'), 'utf-8');
    const apiContent = await fs.readFile(path.join(outputDir, 'api.ts'), 'utf-8');

    expect(typesContent).toContain('export interface ApiUser');
    expect(apiContent).toContain('Promise<Types.ApiUser>');
    expect(apiContent).not.toContain('Promise<Types.User>');
    expect(apiContent).toContain('async getUserById(');
  });

  it('should unwrap responseWrapper and embed interceptors from config', async () => {
    const wrappedSpec: SwaggerSpec = {
      swagger: '2.0',
      info: { title: 'Wrapper Test API', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            operationId: 'getUserById',
            tags: ['user'],
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'integer' }
            ],
            responses: {
              '200': {
                description: 'Success',
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'integer' },
                    data: { $ref: '#/definitions/User' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      definitions: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          }
        }
      }
    };

    const parser = new SwaggerParser(wrappedSpec);
    const generator = new TypeScriptGenerator(
      {
        input: './swagger.json',
        output: outputDir,
        generateClient: true,
        axiosInstance: 'apiClient',
        responseWrapper: { field: 'data' },
        interceptors: {
          request: {
            onFulfilled: '(config) => { config.headers["X-Token"] = "test"; return config; }'
          }
        }
      },
      parser
    );

    await generator.generate();

    const apiContent = await fs.readFile(path.join(outputDir, 'api.ts'), 'utf-8');
    expect(apiContent).toContain('Promise<Types.User>');
    expect(apiContent).toContain('?.data ?? body');
    expect(apiContent).toContain('RawResponseInterceptor');
    expect(apiContent).toContain('defaultInterceptors');
    expect(apiContent).toContain('X-Token');
  });

  it('should split api client by tag into modules', async () => {
    const splitSpec: SwaggerSpec = {
      swagger: '2.0',
      info: { title: 'Split Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            tags: ['user'],
            responses: { '200': { description: 'OK', schema: { type: 'array', items: { type: 'string' } } } }
          }
        },
        '/pets': {
          get: {
            operationId: 'getPets',
            tags: ['pet'],
            responses: { '200': { description: 'OK', schema: { type: 'array', items: { type: 'string' } } } }
          }
        }
      }
    };

    const parser = new SwaggerParser(splitSpec);
    const generator = new TypeScriptGenerator(
      {
        input: './swagger.json',
        output: outputDir,
        generateClient: true,
        splitByTag: true
      },
      parser
    );

    await generator.generate();

    const userModule = await fs.readFile(path.join(outputDir, 'modules', 'user.ts'), 'utf-8');
    const apiContent = await fs.readFile(path.join(outputDir, 'api.ts'), 'utf-8');
    const indexContent = await fs.readFile(path.join(outputDir, 'index.ts'), 'utf-8');

    expect(userModule).toContain('export class UserApi');
    expect(userModule).toContain('async getUsers(');
    expect(apiContent).toContain('readonly user: UserApi');
    expect(indexContent).toContain("export * from './modules/user'");
  });

  it('should pass request body via config.data for DELETE methods', async () => {
    const deleteBodySpec: SwaggerSpec = {
      openapi: '3.0.0',
      info: { title: 'Delete Body API', version: '1.0.0' },
      paths: {
        '/items/batch': {
          delete: {
            operationId: 'deleteBatch',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { type: 'array', items: { type: 'integer' } }
                }
              }
            },
            responses: { '200': { description: 'OK' } }
          }
        },
        '/org/scopes/{scope}/users/{userId}/roles': {
          delete: {
            operationId: 'revokeRoles',
            parameters: [
              { name: 'scope', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { roleIds: { type: 'array', items: { type: 'string' } } }
                  }
                }
              }
            },
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    };

    const parser = new SwaggerParser(deleteBodySpec, { silentWarnings: true });
    const generator = new TypeScriptGenerator(
      {
        input: './swagger.json',
        output: outputDir,
        generateClient: true
      },
      parser
    );

    await generator.generate();

    const apiContent = await fs.readFile(path.join(outputDir, 'api.ts'), 'utf-8');
    expect(apiContent).toContain('async deleteBatch(data: number[]');
    expect(apiContent).toContain("this.http.delete<void>('/items/batch', { data, ...config })");
    expect(apiContent).toContain('async revokeRoles(scope: string, userId: string, data:');
    expect(apiContent).toContain('`/org/scopes/${scope}/users/${userId}/roles`, { data, ...config }');
  });
});
