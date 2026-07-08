import { SwaggerParser } from '../parser';
import { SwaggerSpec } from '../types';
import {
  FALLBACK_ARRAY_TYPE,
  FALLBACK_SCALAR_TYPE,
  LOOSE_OBJECT_TYPE
} from '../typeUtils';

describe('SwaggerParser type inference without any', () => {
  it('should use unknown and Record<string, unknown> for loose schemas', () => {
    const spec: SwaggerSpec = {
      openapi: '3.0.0',
      info: { title: 'Loose Types API', version: '1.0.0' },
      paths: {
        '/items': {
          get: {
            operationId: 'getItems',
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        list: {
                          type: 'array'
                        },
                        meta: {
                          type: 'object'
                        },
                        mapField: {
                          type: 'object',
                          additionalProperties: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          EmptySchema: {},
          MapSchema: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        }
      }
    };

    const parser = new SwaggerParser(spec, { silentWarnings: true });
    const endpoint = parser.getApiEndpoints()[0]!;
    const responseType = endpoint.responses[0]!.type;

    expect(responseType).toContain(FALLBACK_ARRAY_TYPE);
    expect(responseType).toContain(LOOSE_OBJECT_TYPE);
    expect(responseType).not.toContain('any');

    const types = parser.getTypeDefinitions();
    const emptySchema = types.find(item => item.name === 'EmptySchema');
    const mapSchema = types.find(item => item.name === 'MapSchema');

    expect(emptySchema?.type).toBe('type');
    expect(emptySchema?.aliasType).toBe(LOOSE_OBJECT_TYPE);
    expect(mapSchema?.aliasType).toBe('Record<string, string>');
  });

  it('should fallback missing body schema to unknown', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Missing Body API', version: '1.0.0' },
      paths: {
        '/submit': {
          post: {
            operationId: 'submit',
            requestBody: {
              required: true,
              content: {
                'application/json': {}
              }
            },
            responses: {
              '200': { description: 'ok' }
            }
          }
        }
      }
    } as unknown as SwaggerSpec;

    const parser = new SwaggerParser(spec, { silentWarnings: true });
    const endpoint = parser.getApiEndpoints()[0]!;
    expect(endpoint.requestBody?.type).toBe(FALLBACK_SCALAR_TYPE);
  });
});
