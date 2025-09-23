#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Command } from 'commander';
import { generateFromSwagger, createDefaultConfig } from './index';
import { GeneratorConfig } from './types';

const program = new Command();

program
  .name('swagger-to-ts')
  .description('从 Swagger/OpenAPI 规范生成 TypeScript 接口和 API 客户端')
  .version('1.1.7');

program
  .command('generate')
  .description('生成 TypeScript 代码')
  .option('-i, --input <file>', 'Swagger/OpenAPI 文件路径 (JSON 格式)')
  .option('-o, --output <dir>', '输出目录')
  .option('-b, --base-url <url>', 'API 基础 URL')
  .option('-p, --type-prefix <prefix>', '类型前缀', '')
  .option('--no-client', '不生成 API 客户端')
  .option('-c, --config <file>', '配置文件路径')
  .action(async (options) => {
    try {
      let config: GeneratorConfig;
      
      // 如果指定了配置文件，则从文件加载配置
      if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`❌ 配置文件不存在: ${configPath}`);
          process.exit(1);
        }
        
        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
        
        // 验证配置文件中的必需字段
        if (!config.input) {
          console.error('❌ 配置文件中缺少 input 字段');
          process.exit(1);
        }
        if (!config.output) {
          console.error('❌ 配置文件中缺少 output 字段');
          process.exit(1);
        }
      } else {
        // 验证命令行参数
        if (!options.input) {
          console.error('❌ 请指定输入文件 (-i) 或使用配置文件 (-c)');
          process.exit(1);
        }
        if (!options.output) {
          console.error('❌ 请指定输出目录 (-o) 或使用配置文件 (-c)');
          process.exit(1);
        }
        
        // 使用命令行参数创建配置
        const inputPath = options.input.startsWith('http://') || options.input.startsWith('https://') 
          ? options.input 
          : path.resolve(options.input);
        config = createDefaultConfig(
          inputPath,
          path.resolve(options.output)
        );
      }
      
      // 命令行参数覆盖配置文件
      if (options.baseUrl) {
        config.baseURL = options.baseUrl;
      }
      if (options.typePrefix !== undefined) {
        config.typePrefix = options.typePrefix;
      }
      if (options.client === false) {
        config.generateClient = false;
      }
      
      // 验证输入文件（仅对本地文件进行验证）
      if (!config.input.startsWith('http://') && !config.input.startsWith('https://')) {
        if (!fs.existsSync(config.input)) {
          console.error(`❌ 输入文件不存在: ${config.input}`);
          process.exit(1);
        }
      }
      
      console.log('🚀 开始生成代码...');
      console.log(`📁 输入源: ${config.input}`);
      console.log(`📁 输出目录: ${config.output}`);
      
      await generateFromSwagger(config);
      
    } catch (error) {
      console.error('❌ 生成失败:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('创建配置文件模板')
  .option('-o, --output <file>', '配置文件输出路径', 'swagger-to-ts.config.json')
  .action((options) => {
    const configTemplate: GeneratorConfig = {
      input: './swagger.json',
      output: './src/api',
      baseURL: 'https://api.example.com',
      typePrefix: '',
      axiosInstance: 'apiClient',
      generateClient: true
    };
    
    const configPath = path.resolve(options.output);
    
    if (fs.existsSync(configPath)) {
      console.error(`❌ 配置文件已存在: ${configPath}`);
      process.exit(1);
    }
    
    fs.writeFileSync(configPath, JSON.stringify(configTemplate, null, 2), 'utf-8');
    console.log(`✅ 配置文件已创建: ${configPath}`);
    console.log('💡 请编辑配置文件后运行: swagger-to-ts generate -c ' + options.output);
  });

program
  .command('validate')
  .description('验证 Swagger/OpenAPI 文件')
  .requiredOption('-i, --input <file>', 'Swagger/OpenAPI 文件路径')
  .action(async (options) => {
    try {
      const input = options.input;
      let content: string;
      
      // 支持 URL 和本地文件
       if (input.startsWith('http://') || input.startsWith('https://')) {
         console.log(`🌐 从 URL 获取文件: ${input}`);
         try {
           const response = await axios.get(input, {
             timeout: 10000,
             headers: {
               'Accept': 'application/json, application/yaml, text/yaml'
             }
           });
           content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
         } catch (error) {
           console.error(`❌ 无法获取 URL 内容: ${error}`);
           process.exit(1);
         }
       } else {
        const inputPath = path.resolve(input);
        if (!fs.existsSync(inputPath)) {
          console.error(`❌ 文件不存在: ${inputPath}`);
          process.exit(1);
        }
        content = fs.readFileSync(inputPath, 'utf-8');
      }
      
      const spec = JSON.parse(content);
      
      // 基本验证
      if (!spec.swagger && !spec.openapi) {
        console.error('❌ 不是有效的 Swagger/OpenAPI 文件');
        process.exit(1);
      }
      
      if (!spec.info) {
        console.error('❌ 缺少 info 字段');
        process.exit(1);
      }
      
      if (!spec.paths) {
        console.error('❌ 缺少 paths 字段');
        process.exit(1);
      }
      
      console.log('✅ Swagger/OpenAPI 文件验证通过');
      console.log(`📋 标题: ${spec.info.title}`);
      console.log(`🔖 版本: ${spec.info.version}`);
      console.log(`🛣️  路径数量: ${Object.keys(spec.paths).length}`);
      
      if (spec.swagger) {
        console.log(`📄 Swagger 版本: ${spec.swagger}`);
      }
      if (spec.openapi) {
        console.log(`📄 OpenAPI 版本: ${spec.openapi}`);
      }
      
    } catch (error) {
      console.error('❌ 文件验证失败:', error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();