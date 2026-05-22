#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { generateFromSwagger, createDefaultConfig } from './index';
import { loadSpec, isRemoteInput, validateSpecStructure } from './loadSpec';
import {
  detectConfigFormat,
  expandConfigPaths,
  loadConfigFiles,
  renderConfigTemplate
} from './loadConfig';
import { SwaggerParser } from './parser';
import { GeneratorConfig } from './types';

function getPackageVersion(): string {
  const pkgPath = path.join(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

function parseListOption(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function applyGenerateOptions(config: GeneratorConfig, options: Record<string, unknown>): void {
  if (options.baseUrl) config.baseURL = options.baseUrl as string;
  if (options.typePrefix !== undefined) config.typePrefix = options.typePrefix as string;
  if (options.client === false) config.generateClient = false;
  if (options.responseWrapper) {
    config.responseWrapper = options.responseWrapper === true
      ? true
      : { field: options.responseWrapper as string };
  }
  if (options.filterTags) config.filterTags = parseListOption(options.filterTags as string);
  if (options.filterPaths) config.filterPaths = parseListOption(options.filterPaths as string);
  if (options.excludeDeprecated) config.excludeDeprecated = true;
  if (typeof options.splitByTag === 'boolean') config.splitByTag = options.splitByTag;
  if (options.silentWarnings) config.silentWarnings = true;
  if (options.fetchTimeout !== undefined) {
    config.fetchTimeout = Number(options.fetchTimeout);
  }
}

function collectConfigPaths(options: Record<string, unknown>): string[] {
  const configOption = options.config;
  if (!configOption) return [];

  if (Array.isArray(configOption)) {
    return expandConfigPaths(configOption as string[]);
  }

  return expandConfigPaths([String(configOption)]);
}

async function runGenerateForConfig(config: GeneratorConfig, index: number, total: number): Promise<void> {
  if (!isRemoteInput(config.input) && !fs.existsSync(config.input)) {
    throw new Error(`输入文件不存在: ${config.input}`);
  }

  if (total > 1) {
    console.log(`\n📦 [${index + 1}/${total}] 开始处理配置: ${config.input} -> ${config.output}`);
  }

  console.log('🚀 开始生成代码...');
  console.log(`📁 输入源: ${config.input}`);
  console.log(`📁 输出目录: ${config.output}`);
  console.log(`📂 拆分模式: ${config.splitByTag ? '按 tag 拆分 (modules/)' : '单文件 api.ts'}`);

  await generateFromSwagger(config);
}

const program = new Command();

program
  .name('swagger-to-ts')
  .description('从 Swagger/OpenAPI 规范生成 TypeScript 接口和 API 客户端')
  .version(getPackageVersion());

program
  .command('generate')
  .description('生成 TypeScript 代码')
  .option('-i, --input <file>', 'Swagger/OpenAPI 文件路径 (JSON/YAML) 或 URL')
  .option('-o, --output <dir>', '输出目录')
  .option('-b, --base-url <url>', 'API 基础 URL')
  .option('-p, --type-prefix <prefix>', '类型前缀', '')
  .option('--no-client', '不生成 API 客户端')
  .option('-c, --config <paths...>', '配置文件，支持 json/yaml/js/ts，可指定多个')
  .option('--response-wrapper [field]', '解包统一响应结构，默认字段 data')
  .option('--filter-tags <tags>', '只生成指定 tag，逗号分隔')
  .option('--filter-paths <paths>', '只生成指定路径，逗号分隔，支持 * 通配')
  .option('--exclude-deprecated', '排除 deprecated 端点')
  .option('--split-by-tag', '按 tag 拆分为 modules/*.ts')
  .option('--silent-warnings', '不在解析过程中逐条打印警告')
  .option('--fetch-timeout <ms>', '远程 URL 拉取超时（毫秒）')
  .action(async (options) => {
    try {
      const configPaths = collectConfigPaths(options);
      let configs: GeneratorConfig[];

      if (configPaths.length > 0) {
        configs = await loadConfigFiles(configPaths);
      } else {
        if (!options.input) {
          console.error('❌ 请指定输入文件 (-i) 或使用配置文件 (-c)');
          process.exit(1);
        }
        if (!options.output) {
          console.error('❌ 请指定输出目录 (-o) 或使用配置文件 (-c)');
          process.exit(1);
        }

        const inputPath = isRemoteInput(options.input)
          ? options.input
          : path.resolve(options.input);
        configs = [createDefaultConfig(inputPath, path.resolve(options.output))];
      }

      configs.forEach(config => applyGenerateOptions(config, options));

      for (let i = 0; i < configs.length; i++) {
        await runGenerateForConfig(configs[i], i, configs.length);
      }

      if (configs.length > 1) {
        console.log(`\n✅ 全部完成，共生成 ${configs.length} 份配置`);
      }
    } catch (error) {
      console.error('❌ 生成失败:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('创建配置文件模板')
  .option('-o, --output <file>', '配置文件输出路径', 'swagger-to-ts.config.json')
  .option('--multi', '生成多配置模板')
  .action((options) => {
    const configPath = path.resolve(options.output);
    const format = detectConfigFormat(configPath);
    const content = renderConfigTemplate(format, Boolean(options.multi));

    if (fs.existsSync(configPath)) {
      console.error(`❌ 配置文件已存在: ${configPath}`);
      process.exit(1);
    }

    fs.writeFileSync(configPath, content, 'utf-8');
    console.log(`✅ 配置文件已创建: ${configPath}`);
    console.log(`📄 格式: ${format}${options.multi ? ' (multi)' : ''}`);
    console.log('💡 请编辑配置文件后运行: swagger-to-ts generate -c ' + options.output);
  });

program
  .command('validate')
  .description('验证 Swagger/OpenAPI 文件')
  .requiredOption('-i, --input <file>', 'Swagger/OpenAPI 文件路径或 URL')
  .option('--report', '输出完整警告列表')
  .action(async (options) => {
    try {
      const input = options.input;

      if (isRemoteInput(input)) {
        console.log(`🌐 从 URL 获取文件: ${input}`);
      }

      const spec = await loadSpec(input);
      validateSpecStructure(spec);

      const parser = new SwaggerParser(spec, { silentWarnings: true });
      const endpoints = parser.getApiEndpoints();
      const types = parser.getTypeDefinitions();
      const warnings = parser.getWarnings();

      console.log('✅ Swagger/OpenAPI 文件验证通过');
      console.log(`📋 标题: ${spec.info.title}`);
      console.log(`🔖 版本: ${spec.info.version}`);
      console.log(`🛣️  路径数量: ${Object.keys(spec.paths).length}`);
      console.log(`🔌 API 端点: ${endpoints.length}`);
      console.log(`📄 类型定义: ${types.length}`);

      if (spec.swagger) {
        console.log(`📄 Swagger 版本: ${spec.swagger}`);
      }
      if (spec.openapi) {
        console.log(`📄 OpenAPI 版本: ${spec.openapi}`);
      }

      if (warnings.length > 0) {
        console.log(`⚠️  规范警告: ${warnings.length} 条`);
        if (options.report) {
          warnings.forEach((warning, index) => {
            const location = warning.location ? `[${warning.location}] ` : '';
            console.log(`  ${index + 1}. ${location}${warning.message}`);
          });
        } else {
          console.log('💡 使用 --report 查看完整警告列表');
        }
      }
    } catch (error) {
      console.error('❌ 文件验证失败:', error);
      process.exit(1);
    }
  });

program.parse();
