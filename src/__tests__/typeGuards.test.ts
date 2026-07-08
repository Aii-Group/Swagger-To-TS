import { isSwaggerSpec, parseGeneratorConfig } from '../typeGuards';

describe('typeGuards', () => {
  it('should validate swagger spec structure', () => {
    expect(isSwaggerSpec({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {}
    })).toBe(true);

    expect(isSwaggerSpec({ info: { title: 'x', version: '1' }, paths: {} })).toBe(false);
    expect(isSwaggerSpec(null)).toBe(false);
  });

  it('should parse generator config with typed fields', () => {
    const config = parseGeneratorConfig({
      input: './swagger.json',
      output: './src/api',
      baseURL: '/api',
      typePrefix: 'Api',
      generateClient: true,
      filterTags: ['user'],
      responseWrapper: { field: 'data' }
    }, 'test.json');

    expect(config.input).toBe('./swagger.json');
    expect(config.baseURL).toBe('/api');
    expect(config.typePrefix).toBe('Api');
    expect(config.filterTags).toEqual(['user']);
    expect(config.responseWrapper).toEqual({ field: 'data' });
  });

  it('should reject invalid config fields', () => {
    expect(() => parseGeneratorConfig({}, 'bad.json')).toThrow('input');
    expect(() => parseGeneratorConfig({
      input: './swagger.json',
      output: './out',
      fetchTimeout: 'invalid'
    }, 'bad.json')).toThrow('fetchTimeout');
  });
});
