import { parseSpecContent, validateSpecStructure } from '../loadSpec';
import { SwaggerSpec } from '../types';

const jsonSpec: SwaggerSpec = {
  openapi: '3.0.0',
  info: { title: 'JSON API', version: '1.0.0' },
  paths: {
    '/health': {
      get: {
        operationId: 'healthCheck',
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};

const yamlSpec = `
openapi: 3.0.0
info:
  title: YAML API
  version: 1.0.0
paths:
  /health:
    get:
      operationId: healthCheck
      responses:
        '200':
          description: OK
`;

describe('loadSpec utilities', () => {
  describe('parseSpecContent', () => {
    it('should parse JSON content', () => {
      const spec = parseSpecContent(JSON.stringify(jsonSpec), './swagger.json');
      expect(spec.info.title).toBe('JSON API');
    });

    it('should parse YAML content by extension', () => {
      const spec = parseSpecContent(yamlSpec, './swagger.yaml');
      expect(spec.info.title).toBe('YAML API');
    });

    it('should parse YAML content without json-like prefix', () => {
      const spec = parseSpecContent(yamlSpec);
      expect(spec.info.title).toBe('YAML API');
    });

    it('should reject invalid swagger structure during parse', () => {
      expect(() => parseSpecContent('title: broken\n', 'broken.yaml')).toThrow();
    });
  });

  describe('validateSpecStructure', () => {
    it('should accept valid OpenAPI spec', () => {
      expect(() => validateSpecStructure(jsonSpec)).not.toThrow();
    });

    it('should reject spec without openapi/swagger field', () => {
      expect(() => validateSpecStructure({ info: { title: 'x', version: '1' }, paths: {} } as SwaggerSpec))
        .toThrow('Not a valid Swagger/OpenAPI file');
    });

    it('should reject spec without info field', () => {
      expect(() => validateSpecStructure({ openapi: '3.0.0', paths: {} } as SwaggerSpec))
        .toThrow('Missing required field: info');
    });

    it('should reject spec without paths field', () => {
      expect(() => validateSpecStructure({ openapi: '3.0.0', info: { title: 'x', version: '1' } } as SwaggerSpec))
        .toThrow('Missing required field: paths');
    });
  });
});
