module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 提交类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 Bug
        'docs',     // 文档更新
        'style',    // 代码格式化
        'refactor', // 重构代码
        'perf',     // 性能优化
        'test',     // 测试相关
        'build',    // 构建系统变更
        'ci',       // CI/CD 配置
        'chore',    // 其他变更
        'revert'    // 回滚提交
      ]
    ],
    // 作用域枚举
    'scope-enum': [
      2,
      'always',
      [
        'parser',    // 解析器相关
        'generator', // 代码生成器相关
        'cli',       // 命令行工具相关
        'types',     // 类型定义相关
        'config',    // 配置处理相关
        'client',    // API 客户端相关
        'examples',  // 示例代码相关
        'deps'       // 依赖管理相关
      ]
    ],
    // 主题不能为空
    'subject-empty': [2, 'never'],
    // 主题最大长度
    'subject-max-length': [2, 'always', 50],
    // 主题不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // 类型必须小写
    'type-case': [2, 'always', 'lower-case'],
    // 类型不能为空
    'type-empty': [2, 'never'],
    // 作用域必须小写
    'scope-case': [2, 'always', 'lower-case'],
    // 正文每行最大长度
    'body-max-line-length': [2, 'always', 72],
    // 页脚每行最大长度
    'footer-max-line-length': [2, 'always', 72]
  }
};