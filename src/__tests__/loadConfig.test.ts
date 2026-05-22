import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  detectConfigFormat,
  expandConfigPaths,
  loadConfigFile,
  loadConfigFiles,
  normalizeConfigExport,
  renderConfigTemplate,
  validateConfig
} from '../loadConfig';
import { GeneratorConfig } from '../types';

const baseConfig: GeneratorConfig = {
  input: './swagger.json',
  output: './src/api'
};

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-config-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should normalize single, array and configs wrapper exports', () => {
    expect(normalizeConfigExport(baseConfig, 'single')).toHaveLength(1);
    expect(normalizeConfigExport([baseConfig, baseConfig], 'array')).toHaveLength(2);
    expect(normalizeConfigExport({ configs: [baseConfig] }, 'wrapper')).toHaveLength(1);
  });

  it('should validate required fields', () => {
    expect(() => validateConfig({}, 'invalid')).toThrow('Missing "input"');
    expect(() => validateConfig({ input: './a.json' }, 'invalid')).toThrow('Missing "output"');
  });

  it('should expand comma-separated config paths', () => {
    expect(expandConfigPaths(['a.json,b.yaml', 'c.ts'])).toEqual(['a.json', 'b.yaml', 'c.ts']);
  });

  it('should load json config file', async () => {
    const filePath = path.join(tempDir, 'config.json');
    await fs.writeJson(filePath, baseConfig);

    const configs = await loadConfigFile(filePath);
    expect(configs).toHaveLength(1);
    expect(configs[0].output).toBe('./src/api');
  });

  it('should load yaml config file', async () => {
    const filePath = path.join(tempDir, 'config.yaml');
    await fs.writeFile(
      filePath,
      'input: ./swagger.yaml\noutput: ./src/api\nbaseURL: /api\n',
      'utf-8'
    );

    const configs = await loadConfigFile(filePath);
    expect(configs[0].baseURL).toBe('/api');
  });

  it('should load js config file', async () => {
    const filePath = path.join(tempDir, 'config.js');
    await fs.writeFile(
      filePath,
      'module.exports = { input: "./swagger.json", output: "./src/api/js" };',
      'utf-8'
    );

    const configs = await loadConfigFile(filePath);
    expect(configs[0].output).toBe('./src/api/js');
  });

  it('should load ts config file with default export', async () => {
    const filePath = path.join(tempDir, 'config.ts');
    await fs.writeFile(
      filePath,
      'export default { input: "./swagger.json", output: "./src/api/ts" };',
      'utf-8'
    );

    const configs = await loadConfigFile(filePath);
    expect(configs[0].output).toBe('./src/api/ts');
  });

  it('should load ts config file with default array export', async () => {
    const filePath = path.join(tempDir, 'config.ts');
    await fs.writeFile(
      filePath,
      'export default [{ input: "./swagger.json", output: "./src/api/ts-array" }];',
      'utf-8'
    );

    const configs = await loadConfigFile(filePath);
    expect(configs).toHaveLength(1);
    expect(configs[0].output).toBe('./src/api/ts-array');
  });

  it('should load multiple config files', async () => {
    const first = path.join(tempDir, 'a.json');
    const second = path.join(tempDir, 'b.json');
    await fs.writeJson(first, { ...baseConfig, output: './src/api/a' });
    await fs.writeJson(second, { ...baseConfig, output: './src/api/b' });

    const configs = await loadConfigFiles([first, second]);
    expect(configs).toHaveLength(2);
    expect(configs.map(item => item.output)).toEqual(['./src/api/a', './src/api/b']);
  });

  it('should detect config format from extension', () => {
    expect(detectConfigFormat('swagger-to-ts.config.ts')).toBe('ts');
    expect(detectConfigFormat('swagger-to-ts.config.js')).toBe('js');
    expect(detectConfigFormat('swagger-to-ts.config.yaml')).toBe('yaml');
    expect(detectConfigFormat('swagger-to-ts.config.json')).toBe('json');
  });

  it('should render templates for supported formats', () => {
    expect(renderConfigTemplate('json')).toContain('"input"');
    expect(renderConfigTemplate('yaml')).toContain('input:');
    expect(renderConfigTemplate('js')).toContain('module.exports');
    expect(renderConfigTemplate('ts', true)).toContain('GeneratorConfig[]');
  });
});
