import { SwaggerParser } from '../parser';
import { SwaggerSpec } from '../types';

describe('SwaggerParser discriminated oneOf', () => {
  it('should generate discriminated union from discriminator.mapping', () => {
    const spec: SwaggerSpec = {
      openapi: '3.0.0',
      info: { title: 'Pet API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          Cat: {
            type: 'object',
            required: ['petType'],
            properties: {
              petType: { type: 'string', enum: ['cat'] },
              meow: { type: 'boolean' }
            }
          },
          Dog: {
            type: 'object',
            required: ['petType'],
            properties: {
              petType: { type: 'string', enum: ['dog'] },
              bark: { type: 'boolean' }
            }
          },
          Pet: {
            oneOf: [
              { $ref: '#/components/schemas/Cat' },
              { $ref: '#/components/schemas/Dog' }
            ],
            discriminator: {
              propertyName: 'petType',
              mapping: {
                cat: '#/components/schemas/Cat',
                dog: '#/components/schemas/Dog'
              }
            }
          }
        }
      }
    };

    const parser = new SwaggerParser(spec, { silentWarnings: true });
    const petType = parser.getTypeDefinitions().find(item => item.name === 'Pet');

    expect(petType?.aliasType).toContain("petType: 'cat'");
    expect(petType?.aliasType).toContain("petType: 'dog'");
    expect(petType?.aliasType).toContain('Cat');
    expect(petType?.aliasType).toContain('Dog');
  });
});
