<template>
  <div class="container">
    <h1>File References</h1>

    <div v-if="references.length === 0 && groups.length === 0" class="empty-state">
      <p>No references yet. Add your first reference!</p>
    </div>

    <ul
      v-show="references.length > 0 || groups.length > 0"
      ref="listRef"
      class="references-list"
      @dragover.prevent="onListDragOver"
      @drop.prevent="onListDrop"
    >
      <!-- 分组 -->
      <li
        v-for="group in groups"
        :key="group.id"
        class="reference-group"
        :data-id="group.id"
        draggable="true"
        @dragstart="onGroupDragStart($event, group.id)"
        @dragend="onDragEnd"
        @dragover.prevent="onItemDragOver($event)"
        @dragenter.prevent="onGroupDragEnter($event)"
        @dragleave="onGroupDragLeave($event)"
        @drop.prevent.stop="onGroupDrop($event, group.id)"
      >
        <div
          class="group-header"
          :class="{ expanded: expandedGroups[group.id] }"
          @click="toggleGroup(group.id)"
        >
          <div class="group-title">
            <span class="expand-indicator">▶</span>
            <span>{{ group.name }}</span>
          </div>
          <div class="group-actions">
            <button class="delete-btn" @click.stop="deleteGroup(group.id)">×</button>
          </div>
        </div>

        <div
          class="group-content"
          :style="{ display: expandedGroups[group.id] ? 'block' : 'none' }"
        >
          <ul class="group-items">
            <template v-if="getGroupRefs(group.id).length > 0">
              <li
                v-for="ref in getGroupRefs(group.id)"
                :key="ref.id"
                class="reference-item"
                :data-id="ref.id"
                :data-type="ref.type"
                draggable="true"
                @dragstart="onRefDragStart($event, ref.id)"
                @dragend="onDragEnd"
                @click="jumpTo(ref.id)"
                @contextmenu.prevent="showGroupModal(ref.id)"
              >
                <h3 class="reference-title">
                  {{ ref.title }}
                  <span class="reference-type" :data-type="ref.type">
                    {{ typeLabels[ref.type] }}
                  </span>
                </h3>
                <div class="reference-actions">
                  <button
                    v-if="ref.groupId"
                    class="ungroup-btn"
                    @click.stop="updateReferenceGroup(ref.id, null)"
                  >
                    取消分组
                  </button>
                  <button class="edit-btn" @click.stop="showEditModal(ref.id, ref.title)">
                    分组
                  </button>
                  <button class="edit-btn" @click.stop="showEditModal(ref.id, ref.title)">
                    编辑
                  </button>
                  <button class="delete-btn" @click.stop="deleteReference(ref.id)">×</button>
                </div>
              </li>
            </template>
            <li v-else class="empty-group-item">此分组为空，拖拽引用项至此</li>
          </ul>
        </div>
      </li>

      <!-- 未分组引用 -->
      <li
        v-for="ref in ungroupedReferences"
        :key="ref.id"
        class="reference-item"
        :data-id="ref.id"
        :data-type="ref.type"
        draggable="true"
        @dragstart="onRefDragStart($event, ref.id)"
        @dragend="onDragEnd"
        @click="jumpTo(ref.id)"
        @contextmenu.prevent="showGroupModal(ref.id)"
      >
        <h3 class="reference-title">
          {{ ref.title }}
          <span class="reference-type" :data-type="ref.type">
            {{ typeLabels[ref.type] }}
          </span>
        </h3>
        <div class="reference-actions">
          <button class="edit-btn" @click.stop="openGroupAssign(ref.id)">分组</button>
          <button class="edit-btn" @click.stop="showEditModal(ref.id, ref.title)">编辑</button>
          <button class="delete-btn" @click.stop="deleteReference(ref.id)">×</button>
        </div>
      </li>
    </ul>

    <div class="actions-bar">
      <button class="action-btn" @click="showStorage">Show Storage Location</button>
    </div>

    <!-- 编辑标题弹窗 -->
    <Teleport to="body">
      <div v-if="editModal.visible" class="modal" @click.self="hideEditModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">编辑标题</h3>
            <button class="close-btn" @click="hideEditModal">&times;</button>
          </div>
          <div class="form-group">
            <label class="form-label">标题</label>
            <input
              ref="titleInputRef"
              v-model="editModal.title"
              class="form-input"
              placeholder="输入标题..."
              @keydown.enter="saveTitle"
              @keydown.esc="hideEditModal"
            />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="hideEditModal">取消</button>
            <button class="btn btn-primary" @click="saveTitle">保存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 移动到分组弹窗 -->
    <Teleport to="body">
      <div v-if="groupModal.visible" class="modal" @click.self="hideGroupModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">移动到分组</h3>
            <button class="close-btn" @click="hideGroupModal">&times;</button>
          </div>
          <div class="form-group">
            <label class="form-label">选择分组</label>
            <select v-model="groupModal.selectedGroupId" class="form-select">
              <option value="">无分组</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="hideGroupModal">取消</button>
            <button class="btn btn-primary" @click="moveToGroup">移动</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 添加分组弹窗 -->
    <Teleport to="body">
      <div v-if="addGroupModal.visible" class="modal" @click.self="hideAddGroupModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">添加分组</h3>
            <button class="close-btn" @click="hideAddGroupModal">&times;</button>
          </div>
          <div class="form-group">
            <label class="form-label">分组名称</label>
            <input
              ref="groupNameInputRef"
              v-model="addGroupModal.name"
              class="form-input"
              placeholder="输入分组名称..."
              @keydown.enter="createGroup"
              @keydown.esc="hideAddGroupModal"
            />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="hideAddGroupModal">取消</button>
            <button class="btn btn-primary" @click="createGroup">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import { defineStore } from 'pinia'
import { useVsCodeApiStore } from '@/stores/vscode'

/* ========== 类型定义 ========== */

interface Reference {
  id: string
  title: string
  type: 'file' | 'file-snippet' | 'global-snippet' | 'comment'
  groupId?: string | null
  order?: number
}

interface Group {
  id: string
  name: string
  order?: number
}

interface VSCodeMessage {
  command: string
  [key: string]: unknown
}

/* ========== VS Code API 兼容 ========== */

interface VSCodeApi {
  postMessage: (msg: VSCodeMessage) => void
}

// function getVSCodeApi(): VSCodeApi | null {
function getVSCodeApi(): any {
  if (typeof useVsCodeApiStore === 'function') {
    const vscode = useVsCodeApiStore().vscode
    return vscode
  }
  return null
}

const vscode = getVSCodeApi()

function postMessage(msg: VSCodeMessage) {
  if (vscode) {
    vscode.postMessage(msg)
  } else {
    console.log('[FileRefTags] postMessage:', msg)
  }
}

/* ========== 常量 ========== */

const typeLabels: Record<string, string> = {
  file: '文件',
  'file-snippet': '片段',
  'global-snippet': '全局',
  comment: '注释',
}

/* ========== 响应式状态 ========== */

const references = ref<Reference[]>([])
const groups = ref<Group[]>([])
const expandedGroups = ref<Record<string, boolean>>({})

const listRef = ref<HTMLUListElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const groupNameInputRef = ref<HTMLInputElement | null>(null)

// 拖拽状态
let dragType: 'reference' | 'group' | null = null
let dragId: string | null = null

/* ========== 弹窗状态 ========== */

const editModal = reactive({
  visible: false,
  id: null as string | null,
  title: '',
})

const groupModal = reactive({
  visible: false,
  id: null as string | null,
  selectedGroupId: '',
})

const addGroupModal = reactive({
  visible: false,
  name: '',
})

/* ========== 计算属性 ========== */

const ungroupedReferences = computed(() =>
  references.value.filter((r) => !r.groupId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

/* ========== 工具方法 ========== */

function getGroupRefs(groupId: string): Reference[] {
  return references.value
    .filter((r) => r.groupId === groupId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/* ========== 弹窗操作 ========== */

function showEditModal(id: string, currentTitle: string) {
  editModal.id = id
  editModal.title = currentTitle
  editModal.visible = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function hideEditModal() {
  editModal.visible = false
  editModal.id = null
  editModal.title = ''
}

function saveTitle() {
  if (!editModal.id) return
  const trimmed = editModal.title.trim()
  if (!trimmed) return
  postMessage({ command: 'updateReferenceTitle', id: editModal.id, title: trimmed })
  hideEditModal()
}

function showGroupModal(id: string) {
  groupModal.id = id
  const ref = references.value.find((r) => r.id === id)
  groupModal.selectedGroupId = ref?.groupId ?? ''
  groupModal.visible = true
}

function hideGroupModal() {
  groupModal.visible = false
  groupModal.id = null
}

function moveToGroup() {
  if (!groupModal.id) return
  postMessage({
    command: 'updateReferenceGroup',
    id: groupModal.id,
    groupId: groupModal.selectedGroupId || null,
  })
  hideGroupModal()
}

function openGroupAssign(id: string) {
  showGroupModal(id)
}

function showAddGroupModal() {
  addGroupModal.name = ''
  addGroupModal.visible = true
  nextTick(() => groupNameInputRef.value?.focus())
}

function hideAddGroupModal() {
  addGroupModal.visible = false
  addGroupModal.name = ''
}

function createGroup() {
  const trimmed = addGroupModal.name.trim()
  if (!trimmed) return
  postMessage({ command: 'addGroup', name: trimmed })
  hideAddGroupModal()
}

/* ========== 业务操作 ========== */

function toggleGroup(groupId: string) {
  expandedGroups.value[groupId] = !expandedGroups.value[groupId]
}

function deleteGroup(id: string) {
  postMessage({ command: 'deleteGroup', id })
}

function deleteReference(id: string) {
  postMessage({ command: 'deleteReference', id })
}

function updateReferenceGroup(id: string, groupId: string | null) {
  postMessage({ command: 'updateReferenceGroup', id, groupId })
}

function jumpTo(id: string) {
  postMessage({ command: 'jumpToReference', id })
}

function showStorage() {
  postMessage({ command: 'showStorageLocation' })
}

/* ========== 拖拽 ========== */

function onRefDragStart(e: DragEvent, id: string) {
  dragType = 'reference'
  dragId = id
  e.dataTransfer?.setData('text/x-reference-item', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  ;(e.target as HTMLElement).classList.add('dragging')
}

function onGroupDragStart(e: DragEvent, id: string) {
  dragType = 'group'
  dragId = id
  e.dataTransfer?.setData('text/x-group', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  ;(e.target as HTMLElement).classList.add('dragging')
}

function onDragEnd(e: DragEvent) {
  clearDragIndicators()
  ;(e.target as HTMLElement).classList.remove('dragging')
  dragType = null
  dragId = null
}

function onGroupDragEnter(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.add('drag-over')
}

function onGroupDragLeave(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
}

function onGroupDrop(e: DragEvent, groupId: string) {
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  const refId = e.dataTransfer?.getData('text/x-reference-item')
  if (refId) {
    updateReferenceGroup(refId, groupId)
  }
}

function onItemDragOver(e: DragEvent) {
  if (!e.dataTransfer) return
  const types = Array.from(e.dataTransfer.types)

  if (types.includes('text/x-reference-item')) {
    const targetEl = (e.target as HTMLElement).closest('.reference-item') as HTMLElement | null
    if (targetEl && targetEl.dataset.id !== dragId) {
      addSortIndicatorLine(targetEl, e.clientY)
    }
  }

  if (types.includes('text/x-group')) {
    const targetEl = (e.target as HTMLElement).closest('.reference-group') as HTMLElement | null
    if (targetEl && targetEl.dataset.id !== dragId) {
      addGroupSortLine(targetEl, e.clientY)
    }
  }
}

function onListDragOver(_e: DragEvent) {
  // handled by child elements
}

function onListDrop(e: DragEvent) {
  if (!e.dataTransfer) return
  const types = Array.from(e.dataTransfer.types)

  if (types.includes('text/x-reference-item')) {
    const refId = e.dataTransfer.getData('text/x-reference-item')
    const sortLine = document?.querySelector('.sort-drag-line')

    // if (sortLine && sortLine?.parentNode?.classList.contains('group-items')) {
    if (sortLine && (sortLine.parentNode as HTMLElement)?.classList?.contains('group-items')) {
      // 组内排序
      const container = sortLine.parentNode as HTMLElement
      const groupEl = container.closest('.reference-group') as HTMLElement
      const groupId = groupEl?.dataset.id ?? ''
      const items = Array.from(container.querySelectorAll('.reference-item')) as HTMLElement[]
      const idx = Array.from(container.children).indexOf(sortLine)
      const newOrder = items
        .filter((el) => el.dataset.id !== refId)
        .map((el) => el.dataset.id!) as string[]
      newOrder.splice(idx, 0, refId)
      postMessage({ command: 'updateOrder', order: newOrder, groupId })
    } else if (sortLine) {
      // 列表级排序（未分组）
      const list = listRef.value!
      const ungroupedEls = Array.from(
        list.querySelectorAll(':scope > .reference-item'),
      ) as HTMLElement[]
      const idx = Array.from(list.children).indexOf(sortLine)
      let insertPos = 0
      for (let i = 0; i < idx; i++) {
        const child = list.children[i] as HTMLElement
        if (
          child.classList.contains('reference-item') &&
          !child.classList.contains('reference-group')
        ) {
          insertPos++
        }
      }
      const newOrder = ungroupedEls
        .filter((el) => el.dataset.id !== refId)
        .map((el) => el.dataset.id!) as string[]
      newOrder.splice(insertPos, 0, refId)
      postMessage({ command: 'updateOrder', order: newOrder })
    } else {
      // 拖到空白处 → 取消分组
      updateReferenceGroup(refId, null)
    }
  } else if (types.includes('text/x-group')) {
    const groupId = e.dataTransfer.getData('text/x-group')
    const sortLine = document.querySelector('.sort-drag-line')
    if (sortLine) {
      const list = listRef.value!
      const allGroupEls = Array.from(
        list.querySelectorAll(':scope > .reference-group'),
      ) as HTMLElement[]
      const idx = Array.from(list.children).indexOf(sortLine)
      const newOrder = allGroupEls
        .filter((el) => el.dataset.id !== groupId)
        .map((el) => el.dataset.id!) as string[]
      let insertPos = idx
      // adjust for removed element
      const removedBefore = allGroupEls.findIndex((el, i) => el.dataset.id === groupId && i < idx)
      if (removedBefore >= 0) insertPos--
      newOrder.splice(Math.max(0, insertPos), 0, groupId)
      postMessage({ command: 'updateGroupOrder', order: newOrder })
    }
  }

  clearDragIndicators()
}

/* ========== 拖拽指示线 ========== */

function clearDragIndicators() {
  document.querySelectorAll('.sort-drag-line').forEach((el) => el.remove())
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
}

function createSortLineEl(): HTMLLIElement {
  const line = document.createElement('li')
  line.className = 'sort-drag-line'
  return line
}

function addSortIndicatorLine(target: HTMLElement, clientY: number) {
  clearDragIndicators()
  const rect = target.getBoundingClientRect()
  const before = (clientY - rect.top) / rect.height < 0.5
  const line = createSortLineEl()
  target.parentNode!.insertBefore(line, before ? target : target.nextSibling)
}

function addGroupSortLine(target: HTMLElement, clientY: number) {
  clearDragIndicators()
  const rect = target.getBoundingClientRect()
  const before = (clientY - rect.top) / rect.height < 0.5
  const line = createSortLineEl()
  const list = listRef.value!
  list.insertBefore(line, before ? target : target.nextSibling)
}

/* ========== 消息监听 ========== */

onMounted(() => {
  // 监听来自 VS Code 宿主的消息
  window.addEventListener('message', (event: any) => {
    const msg = event?.data
    if (msg.command === 'updateReferences') {
      references.value = msg.references ?? []
      groups.value = msg.groups ?? []
      // 默认展开所有分组
      groups.value.forEach((g) => {
        if (expandedGroups.value[g.id] === undefined) {
          expandedGroups.value[g.id] = true
        }
      })
    }
  })

  // 初始化请求数据
  postMessage({ command: 'getReferences' })
})
</script>

<style scoped>
/* ===== 基础布局 ===== */
.container {
  padding: 6px 2px;
  display: flex;
  flex-direction: column;
  /* height: calc(100vh - 12px); */
  width: 100%;
  height: 100%;
  overflow-y: auto;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
    'Helvetica Neue', sans-serif;
  font-size: 12px;
  font-weight: 400;
  background-color: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-editor-foreground, #d4d4d4);
}

h1 {
  font-size: 13px;
  margin: 0 0 8px 0;
  font-weight: 500;
  color: var(--vscode-foreground, #cccccc);
  padding: 0 6px;
  border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
  padding-bottom: 4px;
}

/* ===== 空状态 ===== */
.empty-state {
  text-align: center;
  padding: 24px 0;
  color: var(--vscode-descriptionForeground, #858585);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 引用列表 ===== */
.references-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

/* ===== 分组 ===== */
.reference-group {
  margin: 6px 2px;
  border: 1px solid var(--vscode-panel-border, #3e3e42);
  border-radius: 4px;
  overflow: hidden;
  background-color: rgba(60, 60, 65, 0.4);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.group-header {
  padding: 6px 8px;
  background-color: rgba(65, 65, 70, 0.5);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
}

.group-title {
  font-weight: 500;
  color: var(--vscode-sideBarTitle-foreground, #e0e0e0);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.group-actions {
  display: flex;
  gap: 3px;
}

.group-content {
  padding: 4px 0;
}

.group-items {
  padding-left: 6px;
}

.expand-indicator {
  transition: transform 0.2s ease;
  font-size: 11px;
}

.group-header.expanded .expand-indicator {
  transform: rotate(90deg);
}

.empty-group-item {
  padding: 8px;
  text-align: center;
  color: var(--vscode-descriptionForeground, #858585);
  font-size: 11px;
}

/* ===== 引用项 ===== */
.reference-item {
  outline: 1px solid var(--vscode-panel-border, #3e3e42);
  padding: 4px 8px;
  margin: 0 4px 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  line-height: 16px;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-radius: 3px;
  min-height: 26px;
}

.reference-item[data-type='file'] {
  background-color: rgba(14, 99, 156, 0.1);
  border-left: 2px solid rgba(14, 99, 156, 0.7);
}

.reference-item[data-type='file-snippet'] {
  background-color: rgba(180, 40, 80, 0.1);
  border-left: 2px solid rgba(180, 40, 80, 0.7);
}

.reference-item[data-type='global-snippet'] {
  background-color: rgba(74, 22, 140, 0.1);
  border-left: 2px solid rgba(74, 22, 140, 0.7);
}

.reference-item[data-type='comment'] {
  background-color: rgba(0, 125, 74, 0.1);
  border-left: 2px solid rgba(0, 125, 74, 0.7);
}

.reference-item:hover {
  background-color: var(--vscode-list-hoverBackground, #2a2d2e) !important;
  outline-color: var(--vscode-input-focusBorder, #0e639c);
  transform: translateX(2px);
}

.reference-title {
  font-size: 12px;
  font-weight: 400;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  color: var(--vscode-editor-foreground, #d4d4d4);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.reference-item:hover .reference-title {
  color: var(--vscode-list-hoverForeground, #cccccc);
}

/* ===== 类型标签 ===== */
.reference-type {
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 6px;
  text-transform: uppercase;
  align-self: flex-start;
}

.reference-type[data-type='file'] {
  background-color: rgba(14, 99, 156, 0.4);
  color: #99ddff;
}

.reference-type[data-type='file-snippet'] {
  background-color: rgba(180, 40, 80, 0.4);
  color: #f6b6c7;
}

.reference-type[data-type='global-snippet'] {
  background-color: rgba(74, 22, 140, 0.4);
  color: #cfa1f0;
}

.reference-type[data-type='comment'] {
  background-color: rgba(0, 125, 74, 0.4);
  color: #77e0b0;
}

/* ===== 操作按钮 ===== */
.reference-actions {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  background: var(--vscode-editor-background, #1e1e1e);
  padding: 1px;
  border-radius: 2px;
}

.reference-item:hover .reference-actions {
  pointer-events: auto;
  opacity: 1;
}

.edit-btn,
.ungroup-btn {
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground, #858585);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 2px;
  min-width: 34px;
}

.edit-btn:hover,
.ungroup-btn:hover {
  color: var(--vscode-textLink-foreground, #3794ff);
  background-color: var(--vscode-toolbar-hoverBackground, #2a2d2e);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground, #858585);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 5px;
  border-radius: 2px;
}

.delete-btn:hover {
  color: var(--vscode-errorForeground, #f48771);
  background-color: var(--vscode-toolbar-hoverBackground, #2a2d2e);
}

/* ===== 底部按钮 ===== */
.actions-bar {
  margin-top: 8px;
  display: flex;
  gap: 4px;
  padding: 0 2px;
}

.action-btn {
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
  border: none;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

/* ===== 弹窗 ===== */
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
}

.modal-content {
  background-color: var(--vscode-editor-background, #1e1e1e);
  margin: 25% auto;
  padding: 12px;
  border: 1px solid var(--vscode-panel-border, #3e3e42);
  border-radius: 4px;
  width: 220px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.modal-title {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  color: var(--vscode-editor-foreground, #d4d4d4);
}

.close-btn {
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground, #858585);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.close-btn:hover {
  background-color: var(--vscode-toolbar-hoverBackground, #2a2d2e);
  color: var(--vscode-editor-foreground, #d4d4d4);
}

.form-group {
  margin-bottom: 10px;
}

.form-label {
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
  color: var(--vscode-descriptionForeground, #858585);
}

.form-input,
.form-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--vscode-input-border, #3e3e42);
  border-radius: 3px;
  background-color: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #cccccc);
  font-size: 12px;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--vscode-input-focusBorder, #0e639c);
  box-shadow: 0 0 0 1px rgba(14, 99, 156, 0.3);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.btn {
  padding: 5px 10px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  min-width: 50px;
}

.btn-primary {
  background-color: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
}

.btn-primary:hover {
  background-color: var(--vscode-button-hoverBackground, #1177bb);
}

.btn-secondary {
  background-color: var(--vscode-button-secondaryBackground, #3e3e42);
  color: var(--vscode-button-secondaryForeground, #cccccc);
}

.btn-secondary:hover {
  background-color: var(--vscode-button-secondaryHoverBackground, #454545);
}

/* ===== 拖拽 ===== */
:deep(.drag-over) {
  background-color: rgba(14, 99, 156, 0.2) !important;
  outline: 1px dashed var(--vscode-input-focusBorder, #0e639c);
}

:deep(.dragging) {
  opacity: 0.5;
}

:deep(.sort-drag-line) {
  height: 2px;
  background-color: var(--vscode-input-focusBorder, #0e639c);
  margin: 2px 0;
  width: 100%;
}
</style>
