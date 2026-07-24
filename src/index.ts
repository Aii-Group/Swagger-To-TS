import { SwaggerParser } from './parser';
import { TypeScriptGenerator } from './generator';
import { filterEndpoints } from './endpointFilter';
import { GeneratorConfig, ValidationWarning } from './types';

function printWarningsSummary(warnings: ValidationWarning[]): void {
  if (warnings.length === 0) return;

  console.log(`\n⚠️  共 ${warnings.length} 条规范警告:`);
  warnings.forEach((warning, index) => {
    const location = warning.location ? `[${warning.location}] ` : '';
    console.log(`  ${index + 1}. ${location}${warning.message}`);
  });
}

/**
 * 从 Swagger/OpenAPI 规范生成 TypeScript 接口和 API 客户端
 * @param config 生成配置
 */
export async function generateFromSwagger(config: GeneratorConfig): Promise<void> {
  try {
    console.log('🚀 开始解析 Swagger 文件...');

    const parser = await SwaggerParser.fromInput(config.input, {
      silentWarnings: config.silentWarnings ?? true,
      fetchTimeout: config.fetchTimeout,
      insecure: config.insecure
    });
    const endpoints = filterEndpoints(parser.getApiEndpoints(), config);
    const types = parser.getTypeDefinitions();

    console.log(`📋 发现 ${endpoints.length} 个 API 端点`);
    console.log(`📄 发现 ${types.length} 个类型定义`);

    console.log('🔧 生成 TypeScript 代码...');
    const generator = new TypeScriptGenerator(config, parser);

    await generator.generate();

    console.log(`✅ 代码生成完成！输出目录: ${config.output}`);
    printWarningsSummary(parser.getWarnings());
  } catch (error) {
    console.error('❌ 生成过程中出现错误:', error);
    throw error;
  }
}

/**
 * 创建默认配置
 * @param input Swagger 文件路径
 * @param output 输出目录
 * @returns 默认配置对象
 */
export function createDefaultConfig(input: string, output: string): GeneratorConfig {
  return {
    input,
    output,
    generateClient: true,
    typePrefix: '',
    axiosInstance: 'apiClient',
    silentWarnings: true
  };
}

// 导出所有类型和类
export * from './types';
export { SwaggerParser } from './parser';
export { TypeScriptGenerator } from './generator';
export {
  loadSpec,
  parseSpecContent,
  validateSpecStructure,
  isRemoteInput,
  isIpHostname,
  createRemoteHttpsAgent
} from './loadSpec';
export {
  loadConfigFile,
  loadConfigFiles,
  normalizeConfigExport,
  validateConfig,
  expandConfigPaths,
  getDefaultConfigTemplate,
  renderConfigTemplate,
  detectConfigFormat
} from './loadConfig';
export {
  filterEndpoints,
  getResponseWrapperField,
  unwrapResponseType,
  buildTagModuleMap,
  createTagModuleIdentifiers,
  matchPathPattern,
  sanitizeTagFileName
} from './endpointFilter';

// 默认导出主函数
export default generateFromSwagger;
