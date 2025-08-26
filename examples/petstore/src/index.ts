import { apiClient, ApiClient, Pet, NewPet } from './api';

// 基本使用示例
async function basicExample() {
  console.log('=== 基本使用示例 ===');
  
  try {
    // 1. 获取所有宠物
    console.log('1. 获取所有宠物...');
    const petsResponse = await apiClient.findPets({ limit: 10 });
    console.log('获取到的宠物:', petsResponse.data);
    
    // 2. 创建新宠物
    console.log('\n2. 创建新宠物...');
    const newPet: NewPet = {
      name: '小白',
      tag: 'dog',
      status: 'available'
    };
    
    const createdPetResponse = await apiClient.addPet(newPet);
    console.log('创建的宠物:', createdPetResponse.data);
    
    // 3. 根据ID获取宠物
    console.log('\n3. 根据ID获取宠物...');
    const petResponse = await apiClient.findPetById(1);
    console.log('获取到的宠物:', petResponse.data);
    
  } catch (error) {
    console.error('API 调用出错:', error);
  }
}

// 自定义客户端示例
async function customClientExample() {
  console.log('\n=== 自定义客户端示例 ===');
  
  // 创建自定义配置的客户端
  const customClient = new ApiClient({
    baseURL: 'https://petstore.swagger.io/api',
    timeout: 5000,
    headers: {
      'Authorization': 'Bearer your-token-here',
      'X-Custom-Header': 'custom-value'
    }
  });
  
  try {
    const response = await customClient.findPets({ limit: 5 });
    console.log('自定义客户端获取的宠物:', response.data);
  } catch (error) {
    console.error('自定义客户端调用出错:', error);
  }
}

// 错误处理示例
async function errorHandlingExample() {
  console.log('\n=== 错误处理示例 ===');
  
  try {
    // 尝试获取不存在的宠物
    await apiClient.findPetById(99999);
  } catch (error: any) {
    if (error && typeof error === 'object') {
      console.log('捕获到 API 错误:');
      console.log('- 状态码:', error.status);
      console.log('- 错误信息:', error.message);
      console.log('- 错误代码:', error.code);
    } else {
      console.error('未知错误:', error);
    }
  }
}

// 类型安全示例
function typeSafetyExample() {
  console.log('\n=== 类型安全示例 ===');
  
  // TypeScript 会提供完整的类型检查和智能提示
  const pet: NewPet = {
    name: '小黑',
    status: 'available' // 只能是 'available' | 'pending' | 'sold'
  };
  
  console.log('类型安全的宠物对象:', pet);
  
  // 编译时类型检查
  // pet.status = 'invalid'; // ❌ TypeScript 会报错
  // pet.unknownField = 'value'; // ❌ TypeScript 会报错
}

// 运行所有示例
async function runAllExamples() {
  console.log('🚀 Petstore API 客户端示例\n');
  
  await basicExample();
  await customClientExample();
  await errorHandlingExample();
  typeSafetyExample();
  
  console.log('\n✅ 所有示例运行完成！');
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  basicExample,
  customClientExample,
  errorHandlingExample,
  typeSafetyExample,
  runAllExamples
};