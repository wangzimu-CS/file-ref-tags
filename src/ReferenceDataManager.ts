import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE } from './view/template';
import { ReferenceItem, ReferenceGroup } from './types/referenct';

// 数据管理类
export class ReferenceDataManager {
  private references: ReferenceItem[] = [];
  private groups: ReferenceGroup[] = []; // 新增：标签组数组
  private storagePath: string;

  constructor(context: vscode.ExtensionContext) {
    // 获取存储路径
    if (context.storageUri) {
      this.storagePath = path.join(context.storageUri?.fsPath, 'references.json');
    } else { 
      this.storagePath = path.join(context.globalStorageUri.fsPath, 'references.json');
    }
    // 确保存储目录存在
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    // 加载数据
    this.loadReferences();
  }

  // 加载引用数据
  private loadReferences(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        const parsedData = JSON.parse(data);
        
        // 如果解析的数据包含groups字段，则同时加载引用和分组
        if (Array.isArray(parsedData.references) && Array.isArray(parsedData.groups)) {
          this.references = parsedData.references;
          this.groups = parsedData.groups;
        } else {
          // 向后兼容：如果数据格式是旧的数组格式
          this.references = Array.isArray(parsedData) ? parsedData : [];
          this.groups = [];
        }
      }
    } catch (error) {
      console.error('Failed to load references:', error);
      this.references = [];
      this.groups = [];
    }
  }

  // 保存引用数据
  private saveReferences(): void {
    try {
      // 保存引用和分组数据
      const dataToSave = {
        references: this.references,
        groups: this.groups
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save references:', error);
    }
  }

  // 添加引用项
  addReference(reference: Omit<ReferenceItem, 'id' | 'createdAt' | 'updatedAt'>): ReferenceItem {
    const now = new Date().toISOString();
    const newReference: ReferenceItem = {
      ...reference,
      id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    };
    this.references.push(newReference);
    this.saveReferences();
    return newReference;
  }

  // 添加标签组
  addGroup(name: string): ReferenceGroup {
    const now = new Date().toISOString();
    const newGroup: ReferenceGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      createdAt: now,
      updatedAt: now
    };
    this.groups.push(newGroup);
    this.saveReferences();
    return newGroup;
  }

  // 获取所有引用项
  getReferences(): ReferenceItem[] {
    return [...this.references];
  }

  // 获取所有标签组
  getGroups(): ReferenceGroup[] {
    return [...this.groups];
  }

  // 更新引用项顺序
  updateOrder(newOrder: string[]): void {
    const newReferences: ReferenceItem[] = [];
    newOrder.forEach(id => {
      const ref = this.references.find(r => r.id === id);
      if (ref) {
        newReferences.push(ref);
      }
    });
    // 添加未在新顺序中的引用项
    this.references.forEach(ref => {
      if (!newOrder.includes(ref.id)) {
        newReferences.push(ref);
      }
    });
    this.references = newReferences;
    this.saveReferences();
  }

  // 更新分组顺序
  updateGroupOrder(newOrder: string[]): void {
    const newGroups: ReferenceGroup[] = [];
    newOrder.forEach(id => {
      const group = this.groups.find(g => g.id === id);
      if (group) {
        newGroups.push(group);
      }
    });
    // 添加未在新顺序中的分组
    this.groups.forEach(group => {
      if (!newOrder.includes(group.id)) {
        newGroups.push(group);
      }
    });
    this.groups = newGroups;
    this.saveReferences();
  }

  // 删除引用项
  deleteReference(id: string): void {
    this.references = this.references.filter(r => r.id !== id);
    this.saveReferences();
  }

  // 删除标签组
  deleteGroup(id: string): void {
    // 移除引用项中对已删除组的引用，将它们改为无分组
    this.references = this.references.map(ref => {
      if (ref.groupId === id) {
        const updatedRef = { ...ref };
        delete updatedRef.groupId;
        return updatedRef;
      }
      return ref;
    });
    // 删除组
    this.groups = this.groups.filter(g => g.id !== id);
    this.saveReferences();
  }

  // 更新引用项标题
  updateReferenceTitle(id: string, title: string): void {
    const reference = this.references.find(r => r.id === id);
    if (reference) {
      reference.title = title;
      reference.updatedAt = new Date().toISOString();
      this.saveReferences();
    }
  }
  
  // 更新引用项目标文件路径
  updateReferenceTargetFilePath(id: string, targetFilePath: string): void {
    const reference = this.references.find(r => r.id === id);
    if (reference) {
      reference.targetFilePath = targetFilePath;
      reference.updatedAt = new Date().toISOString();
      this.saveReferences();
    }
  }

  // 更新引用项的标签组
  updateReferenceGroup(id: string, groupId: string | null): void {
    const reference = this.references.find(r => r.id === id);
    if (reference) {
      if (groupId) {
        reference.groupId = groupId;
      } else {
        delete reference.groupId;
      }
      reference.updatedAt = new Date().toISOString();
      this.saveReferences();
    }
  }

  // 获取存储路径
  getStoragePath(): string {
    return this.storagePath;
  }
}