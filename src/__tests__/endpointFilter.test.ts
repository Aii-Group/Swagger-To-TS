import {
  filterEndpoints,
  matchPathPattern,
  unwrapResponseType,
  createTagModuleIdentifiers,
  buildTagModuleMap
} from '../endpointFilter';
import { ApiEndpoint, GeneratorConfig } from '../types';

const endpoints: ApiEndpoint[] = [
  {
    path: '/users',
    method: 'GET',
    tags: ['user'],
    deprecated: false,
    parameters: [],
    responses: []
  },
  {
    path: '/pets',
    method: 'GET',
    tags: ['pet'],
    deprecated: true,
    parameters: [],
    responses: []
  },
  {
    path: '/orders/1',
    method: 'GET',
    tags: ['order'],
    deprecated: false,
    parameters: [],
    responses: []
  }
];

describe('endpointFilter', () => {
  it('should match path patterns with wildcard', () => {
    expect(matchPathPattern('/users/1', '/users/*')).toBe(true);
    expect(matchPathPattern('/pets', '/users/*')).toBe(false);
  });

  it('should filter by tag', () => {
    const config: GeneratorConfig = {
      input: './swagger.json',
      output: './out',
      filterTags: ['user']
    };
    const result = filterEndpoints(endpoints, config);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/users');
  });

  it('should exclude deprecated endpoints', () => {
    const config: GeneratorConfig = {
      input: './swagger.json',
      output: './out',
      excludeDeprecated: true
    };
    const result = filterEndpoints(endpoints, config);
    expect(result.every(item => !item.deprecated)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('should unwrap response wrapper field from inline type', () => {
    const type = unwrapResponseType(
      '{ code: number; data: User; message: string }',
      'data',
      []
    );
    expect(type).toBe('User');
  });

  it('should unwrap response wrapper field from named type definition', () => {
    const type = unwrapResponseType(
      'ApiResultUser',
      'data',
      [{
        name: 'ApiResultUser',
        properties: {
          code: { type: 'number' },
          data: { type: 'User' },
          message: { type: 'string' }
        }
      }]
    );
    expect(type).toBe('User');
  });
});

describe('tag module identifiers', () => {
  it('should keep ascii tag names readable', () => {
    const ids = createTagModuleIdentifiers('credit-controller', new Set());
    expect(ids.fileName).toBe('credit-controller');
    expect(ids.className).toBe('CreditControllerApi');
    expect(ids.propertyName).toBe('creditController');
  });

  it('should generate valid identifiers for chinese tags', () => {
    const used = new Set<string>();
    const user = createTagModuleIdentifiers('用户', used);
    const account = createTagModuleIdentifiers('账户', used);
    const mixed = createTagModuleIdentifiers('3gpp会话', used);

    expect(user.fileName).toMatch(/^tag-[a-z0-9]+$/);
    expect(user.className).toMatch(/^Tag[A-Za-z0-9]+Api$/);
    expect(user.propertyName).toMatch(/^tag[A-Za-z0-9]+$/);
    expect(user.fileName).not.toMatch(/[\u4e00-\u9fff]/);

    expect(account.fileName).not.toBe(user.fileName);
    expect(account.propertyName).not.toBe(user.propertyName);

    expect(mixed.fileName).toMatch(/^3gpp-[a-z0-9]+$/);
    expect(mixed.className).toMatch(/^Tag3gpp[A-Za-z0-9]+Api$/);
    expect(mixed.propertyName).toMatch(/^tag3gpp[A-Za-z0-9]+$/);
  });

  it('should build unique module map for duplicate-prone tags', () => {
    const map = buildTagModuleMap(['用户', '账户', '临时用户', 'credit-controller']);
    const propertyNames = Array.from(map.values()).map(item => item.propertyName);
    expect(new Set(propertyNames).size).toBe(propertyNames.length);
  });
});
