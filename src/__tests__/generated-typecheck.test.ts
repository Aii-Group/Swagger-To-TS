import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { TypeScriptGenerator } from '../generator';
import { SwaggerParser } from '../parser';
import { SwaggerSpec } from '../types';

const comprehensiveSpec: SwaggerSpec = {
  openapi: '3.0.0',
  info: { title: 'Typecheck API', version: '1.0.0' },
  paths: {
    '/users/{id}': {
      get: {
        operationId: 'getUserById',
        tags: ['user'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'include', in: 'query', required: false, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      },
      post: {
        operationId: 'uploadAvatar',
        tags: ['user'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  avatar: { type: 'string', format: 'binary' },
                  tags: { type: 'array', items: { type: 'string' } }
                },
                required: ['avatar']
              }
            }
          }
        },
        responses: {
          '200': { description: 'OK' }
        }
      }
    },
    '/pets': {
      get: {
        operationId: 'getPets',
        tags: ['pet'],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] }
        }
      }
    }
  }
};

function resolveLocalTscBin(): string {
  return require.resolve('typescript/bin/tsc', {
    paths: [path.resolve(__dirname, '../..')]
  });
}

async function typecheckGeneratedOutput(outputDir: string): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const tsconfigPath = path.join(outputDir, 'tsconfig.json');
  const strictConfig = path.resolve(projectRoot, 'tsconfig.generated.json');
  const nodeModulesLink = path.join(outputDir, 'node_modules');

  if (!(await fs.pathExists(nodeModulesLink))) {
    await fs.symlink(path.join(projectRoot, 'node_modules'), nodeModulesLink, 'dir');
  }

  fs.writeJsonSync(tsconfigPath, {
    extends: strictConfig,
    include: ['**/*.ts']
  });

  const tscBin = resolveLocalTscBin();
  try {
    execSync(`"${process.execPath}" "${tscBin}" --noEmit -p "${tsconfigPath}"`, {
      cwd: outputDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    const details = [execError.stdout, execError.stderr].filter(Boolean).join('\n');
    throw new Error(details || (error instanceof Error ? error.message : String(error)));
  }
}

describe('generated code strict typecheck', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-to-ts-typecheck-'));
  });

  afterEach(async () => {
    await fs.remove(outputDir);
  });

  it('should generate code that passes strict TypeScript checks', async () => {
    const parser = new SwaggerParser(comprehensiveSpec, { silentWarnings: true });
    const generator = new TypeScriptGenerator(
      {
        input: './swagger.json',
        output: outputDir,
        generateClient: true,
        splitByTag: true,
        responseWrapper: { field: 'data' }
      },
      parser
    );

    await generator.generate();

    const apiContent = await fs.readFile(path.join(outputDir, 'api.ts'), 'utf-8');
    const typesContent = await fs.readFile(path.join(outputDir, 'types.ts'), 'utf-8');

    const userModule = await fs.readFile(path.join(outputDir, 'modules', 'user.ts'), 'utf-8');

    expect(apiContent).toContain("import type { AxiosInstance");
    expect(apiContent).toContain('createTypedHttpClient');
    expect(userModule).toContain('.get<');
    expect(apiContent).not.toContain('as any');
    expect(userModule).not.toContain('as any');
    expect(apiContent).toContain('toApiError');
    expect(typesContent).toContain("import type { AxiosResponse");
    expect(typesContent).toContain('AxiosResponse<unknown>');
    expect(typesContent).toContain('TypedHttpClient');

    await expect(typecheckGeneratedOutput(outputDir)).resolves.toBeUndefined();
  });
});
