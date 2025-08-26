// 浏览器环境使用示例
// 这个文件展示了如何在浏览器中使用生成的 API 客户端

// 假设已经通过 <script> 标签或模块系统导入了 API 客户端
// import { apiClient, ApiClient } from './api';

/**
 * 基本的宠物管理功能
 */
class PetManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.petListElement = null;
    this.errorElement = null;
    this.loadingElement = null;
  }

  // 初始化 DOM 元素
  init() {
    this.petListElement = document.getElementById('pet-list');
    this.errorElement = document.getElementById('error-message');
    this.loadingElement = document.getElementById('loading');
    
    // 绑定事件
    document.getElementById('load-pets-btn')?.addEventListener('click', () => this.loadPets());
    document.getElementById('add-pet-btn')?.addEventListener('click', () => this.addPet());
    
    // 初始加载
    this.loadPets();
  }

  // 显示加载状态
  showLoading(show = true) {
    if (this.loadingElement) {
      this.loadingElement.style.display = show ? 'block' : 'none';
    }
  }

  // 显示错误信息
  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.style.display = 'block';
    }
  }

  // 隐藏错误信息
  hideError() {
    if (this.errorElement) {
      this.errorElement.style.display = 'none';
    }
  }

  // 加载宠物列表
  async loadPets() {
    this.showLoading(true);
    this.hideError();
    
    try {
      const response = await this.api.findPets({ limit: 10 });
      this.renderPets(response.data);
    } catch (error) {
      this.showError(`加载宠物列表失败: ${error.message}`);
      console.error('加载宠物失败:', error);
    } finally {
      this.showLoading(false);
    }
  }

  // 渲染宠物列表
  renderPets(pets) {
    if (!this.petListElement) return;
    
    if (!pets || pets.length === 0) {
      this.petListElement.innerHTML = '<p>暂无宠物数据</p>';
      return;
    }

    const petItems = pets.map(pet => `
      <div class="pet-item" style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <h4>${pet.name || '未知宠物'}</h4>
        ${pet.tag ? `<p><strong>标签:</strong> ${pet.tag}</p>` : ''}
        ${pet.status ? `<p><strong>状态:</strong> ${pet.status}</p>` : ''}
        ${pet.id ? `<button onclick="petManager.deletePet(${pet.id})">删除</button>` : ''}
      </div>
    `).join('');

    this.petListElement.innerHTML = petItems;
  }

  // 添加新宠物
  async addPet() {
    const nameInput = document.getElementById('pet-name-input');
    const statusSelect = document.getElementById('pet-status-select');
    
    if (!nameInput || !nameInput.value.trim()) {
      this.showError('请输入宠物名称');
      return;
    }

    this.showLoading(true);
    this.hideError();

    try {
      const newPet = {
        name: nameInput.value.trim(),
        status: statusSelect?.value || 'available'
      };

      await this.api.addPet(newPet);
      nameInput.value = ''; // 清空输入框
      await this.loadPets(); // 重新加载列表
    } catch (error) {
      this.showError(`添加宠物失败: ${error.message}`);
      console.error('添加宠物失败:', error);
    } finally {
      this.showLoading(false);
    }
  }

  // 删除宠物
  async deletePet(petId) {
    if (!confirm('确定要删除这只宠物吗？')) {
      return;
    }

    this.showLoading(true);
    this.hideError();

    try {
      await this.api.deletePet(petId);
      await this.loadPets(); // 重新加载列表
    } catch (error) {
      this.showError(`删除宠物失败: ${error.message}`);
      console.error('删除宠物失败:', error);
    } finally {
      this.showLoading(false);
    }
  }
}

// 全局变量，供 HTML 中的按钮调用
let petManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 这里需要根据实际情况导入 API 客户端
  // 假设 apiClient 已经可用
  if (typeof apiClient !== 'undefined') {
    petManager = new PetManager(apiClient);
    petManager.init();
  } else {
    console.error('API 客户端未找到，请确保正确导入了 API 模块');
  }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetManager };
}