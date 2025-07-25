/**
 * 插件管理器
 *
 * 负责插件的发现、加载、安装、卸载、启用、禁用等核心功能
 */

import { join, dirname } from 'path'
import { app } from 'electron'
import { promises as fs } from 'fs'
import AdmZip from 'adm-zip'
import { net } from 'electron'
import { VnitePluginAPI } from '../api'
import { PluginDBManager } from '~/core/database'
import { eventBus } from '~/core/events'
import log from 'electron-log'
import type {
  PluginManifest,
  PluginInfo,
  PluginInstallOptions,
  PluginSearchOptions,
  PluginRegistry
} from '@appTypes/plugin'
import { IPlugin } from '../api/types'
import { PluginStatus, PluginStatsData } from '@appTypes/plugin'
import { ipcManager } from '~/core/ipc'

export class PluginManager {
  private static instance: PluginManager
  private plugins: Map<string, PluginInfo> = new Map()
  private pluginsDir: string
  private registries: PluginRegistry[] = []
  private loadedModules: Map<string, any> = new Map()

  private constructor() {
    this.pluginsDir = join(app.getPath('userData'), 'plugins')
    this.initializeRegistries()
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager()
    }
    return PluginManager.instance
  }

  /**
   * 初始化插件管理器
   */
  public async initialize(): Promise<void> {
    try {
      // 确保插件目录存在
      await fs.mkdir(this.pluginsDir, { recursive: true })

      // 加载所有已安装的插件
      await this.discoverPlugins()

      // 启用已安装且设置为启用的插件
      await this.loadEnabledPlugins()

      log.info('插件管理器初始化完成')
      // 可以选择发送系统启动完成事件或者移除这个事件
    } catch (error) {
      log.error('插件管理器初始化失败:', error)
      throw error
    }
  }

  /**
   * 发现已安装的插件
   */
  private async discoverPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPluginInfo(entry.name)
        }
      }

      log.info(`发现 ${this.plugins.size} 个已安装的插件`)
    } catch (error) {
      log.error('发现插件失败:', error)
    }
  }

  /**
   * 加载插件信息
   */
  private async loadPluginInfo(pluginId: string): Promise<void> {
    try {
      const pluginDir = join(this.pluginsDir, pluginId)

      // 优先查找 manifest.json，然后是 package.json
      let manifestPath = join(pluginDir, 'manifest.json')
      if (
        !(await fs.access(manifestPath).then(
          () => true,
          () => false
        ))
      ) {
        manifestPath = join(pluginDir, 'package.json')
      }

      // 检查manifest文件是否存在
      try {
        await fs.access(manifestPath)
      } catch {
        log.warn(`插件 ${pluginId} 缺少 manifest.json 或 package.json 文件`)
        return
      }

      // 读取manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest: PluginManifest = JSON.parse(manifestContent)

      // 验证manifest
      if (!this.validateManifest(manifest)) {
        log.warn(`插件 ${pluginId} 的 manifest.json/package.json 格式不正确`)
        return
      }

      const pluginInfo: PluginInfo = {
        manifest,
        status: PluginStatus.DISABLED,
        installPath: pluginDir,
        installTime: new Date(),
        lastUpdateTime: new Date()
      }

      this.plugins.set(pluginId, pluginInfo)

      ipcManager.send('plugin:update-all-plugins', this.getSerializablePlugins())
      ipcManager.send('plugin:update-plugin-stats', this.getPluginStats())

      log.info(`已加载插件信息: ${pluginId}`)
    } catch (error) {
      log.error(`加载插件 ${pluginId} 信息失败:`, error)
    }
  }

  public getPluginStats(): PluginStatsData {
    const plugins = this.getAllPlugins()

    return {
      total: plugins.length,
      enabled: plugins.filter((p) => p.status === 'enabled').length,
      disabled: plugins.filter((p) => p.status === 'disabled').length,
      error: plugins.filter((p) => p.status === 'error').length
    }
  }

  /**
   * 验证插件manifest
   */
  private validateManifest(manifest: any): manifest is PluginManifest {
    return !!(
      manifest.id &&
      manifest.name &&
      manifest.version &&
      manifest.main &&
      manifest.vniteVersion
    )
  }

  /**
   * 加载已启用的插件
   */
  private async loadEnabledPlugins(): Promise<void> {
    // 获取所有已注册的插件ID
    const pluginIds = Array.from(this.plugins.keys())

    // 遍历所有插件，检查数据库中的启用状态
    for (const pluginId of pluginIds) {
      // 从数据库中获取插件的启用状态，默认为false
      const isEnabled = await PluginDBManager.getPluginValue(
        'system',
        `plugins.${pluginId}.enabled`,
        false
      )

      // 如果插件在数据库中标记为启用，则激活它
      if (isEnabled) {
        await this.activatePlugin(pluginId)
      }
    }
  }

  /**
   * 激活插件
   */
  public async activatePlugin(pluginId: string): Promise<void> {
    try {
      const pluginInfo = this.plugins.get(pluginId)
      if (!pluginInfo) {
        throw new Error(`插件 ${pluginId} 不存在`)
      }

      if (pluginInfo.status === PluginStatus.ENABLED) {
        log.warn(`插件 ${pluginId} 已经启用`)
        return
      }

      // 设置状态为加载中
      this.updatePluginStatus(pluginId, PluginStatus.LOADING)

      // 加载插件模块
      const pluginModule = await this.loadPluginModule(pluginInfo)

      // 创建API实例
      const api = new VnitePluginAPI(pluginId)

      // 激活插件
      if (pluginModule.activate) {
        await pluginModule.activate(api)
      }

      // 保存插件实例
      pluginInfo.instance = pluginModule
      this.loadedModules.set(pluginId, pluginModule)

      // 更新状态
      this.updatePluginStatus(pluginId, PluginStatus.ENABLED)
      await PluginDBManager.setPluginValue('system', `plugins.${pluginId}.enabled`, true)

      log.info(`插件 ${pluginId} 激活成功`)
      eventBus.emit('plugin:enabled', { pluginId }, { source: 'PluginManager' })
    } catch (error) {
      log.error(`激活插件 ${pluginId} 失败:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.updatePluginStatus(pluginId, PluginStatus.ERROR, errorMessage)
      throw error
    }
  }

  /**
   * 停用插件
   */
  public async deactivatePlugin(pluginId: string, onQuit = false): Promise<void> {
    try {
      const pluginInfo = this.plugins.get(pluginId)
      if (!pluginInfo) {
        throw new Error(`插件 ${pluginId} 不存在`)
      }

      if (pluginInfo.status !== PluginStatus.ENABLED) {
        log.warn(`插件 ${pluginId} 未启用`)
        return
      }

      const pluginModule = this.loadedModules.get(pluginId)
      if (pluginModule && pluginModule.deactivate) {
        // 创建API实例给deactivate使用
        const api = new VnitePluginAPI(pluginId)
        await pluginModule.deactivate(api)
      }

      // 清理模块缓存
      this.loadedModules.delete(pluginId)
      pluginInfo.instance = undefined

      // 更新状态
      this.updatePluginStatus(pluginId, PluginStatus.DISABLED)
      !onQuit &&
        (await PluginDBManager.setPluginValue('system', `plugins.${pluginId}.enabled`, false))

      log.info(`插件 ${pluginId} 停用成功`)
      eventBus.emit('plugin:disabled', { pluginId }, { source: 'PluginManager' })
    } catch (error) {
      log.error(`停用插件 ${pluginId} 失败:`, error)
      throw error
    }
  }

  /**
   * 加载插件模块
   */
  private async loadPluginModule(pluginInfo: PluginInfo): Promise<IPlugin> {
    const mainPath = join(pluginInfo.installPath, pluginInfo.manifest.main)

    try {
      // 动态导入模块 (支持 ESM 和 CJS)
      let pluginModule: any
      try {
        // 尝试使用动态 import
        pluginModule = await import(mainPath)
      } catch {
        // 回退到 require
        delete require.cache[require.resolve(mainPath)]
        // eslint-disable-next-line
        pluginModule = require(mainPath)
      }

      // 支持ES模块和CommonJS模块
      const plugin = pluginModule.default || pluginModule

      if (!plugin) {
        throw new Error('插件模块未导出有效内容')
      }

      return plugin
    } catch (error) {
      log.error(`加载插件模块失败: ${mainPath}`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`无法加载插件模块: ${errorMessage}`)
    }
  }

  /**
   * 安装插件
   */
  public async installPlugin(
    source: string | Buffer,
    options: PluginInstallOptions = {}
  ): Promise<void> {
    try {
      let pluginBuffer: Buffer

      if (typeof source === 'string') {
        // 从URL下载
        if (source.startsWith('http')) {
          pluginBuffer = await this.downloadPlugin(source)
        } else {
          // 从本地文件读取
          pluginBuffer = await fs.readFile(source)
        }
      } else {
        pluginBuffer = source
      }

      // 解压并安装
      await this.extractAndInstallPlugin(pluginBuffer, options)
    } catch (error) {
      log.error('安装插件失败:', error)
      throw error
    }
  }

  /**
   * 下载插件
   */
  private async downloadPlugin(url: string): Promise<Buffer> {
    try {
      // 使用Electron的net.fetch发起请求
      const response = await net.fetch(url)

      if (!response.ok) {
        throw new Error(`请求失败：${response.status} ${response.statusText}`)
      }

      // 获取响应体
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      // 准备接收数据的数组
      const chunks: Uint8Array[] = []
      let receivedLength = 0

      // 读取数据流
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(value)
        receivedLength += value.length
      }

      // 合并所有接收到的数据块
      const allChunks = new Uint8Array(receivedLength)
      let position = 0
      for (const chunk of chunks) {
        allChunks.set(chunk, position)
        position += chunk.length
      }

      // 转换为Buffer并返回
      return Buffer.from(allChunks)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`下载插件失败: ${errorMessage}`)
    }
  }

  /**
   * 解压并安装插件
   */
  private async extractAndInstallPlugin(
    buffer: Buffer,
    options: PluginInstallOptions
  ): Promise<void> {
    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()

      // 调试：列出所有条目
      log.info(`插件包内容 (共${entries.length}个条目):`)
      entries.forEach((entry, index) => {
        log.debug(
          `  ${index + 1}. ${entry.entryName} ${entry.isDirectory ? '(目录)' : `(文件, ${entry.header.size} bytes)`}`
        )
      })

      // 查找manifest文件 (支持 manifest.json 或 package.json)
      const manifestEntry = entries.find(
        (entry) =>
          (entry.entryName.endsWith('manifest.json') || entry.entryName.endsWith('package.json')) &&
          !entry.entryName.includes('node_modules')
      )

      if (!manifestEntry) {
        throw new Error('插件包中未找到 manifest.json 或 package.json 文件')
      }

      // 解析manifest
      const manifestContent = manifestEntry.getData().toString('utf8')
      const manifest: PluginManifest = JSON.parse(manifestContent)

      if (!this.validateManifest(manifest)) {
        throw new Error('插件 manifest.json/package.json 格式不正确')
      }

      // 检查是否已安装
      if (this.plugins.has(manifest.id) && !options.overwrite) {
        throw new Error(`插件 ${manifest.id} 已安装，使用 overwrite 选项强制覆盖`)
      }

      // 安装目录
      const installDir = join(this.pluginsDir, manifest.id)

      // 如果已存在，先删除
      try {
        await fs.rm(installDir, { recursive: true, force: true })
      } catch {
        // 忽略删除错误
      }

      // 创建安装目录
      await fs.mkdir(installDir, { recursive: true })

      // 解压文件
      const rootDir = dirname(manifestEntry.entryName)
      log.info(`解压插件，根目录: "${rootDir}"，总条目数: ${entries.length}`)

      let extractedFiles = 0
      for (const entry of entries) {
        // 跳过目录
        if (entry.isDirectory) {
          log.debug(`跳过目录: ${entry.entryName}`)
          continue
        }

        let relativePath: string

        if (rootDir === '.') {
          // manifest在根目录的情况
          relativePath = entry.entryName
        } else {
          // manifest在子目录的情况
          if (!entry.entryName.startsWith(rootDir)) {
            log.debug(`跳过不在根目录的文件: ${entry.entryName}`)
            continue
          }
          relativePath = entry.entryName.substring(rootDir.length + 1)
        }

        // 跳过空的相对路径
        if (!relativePath) {
          log.debug(`跳过空相对路径: ${entry.entryName}`)
          continue
        }

        const targetPath = join(installDir, relativePath)
        log.debug(`准备解压: ${entry.entryName} -> ${targetPath}`)

        try {
          // 确保目标目录存在
          await fs.mkdir(dirname(targetPath), { recursive: true })

          // 写入文件 - 转换为 Uint8Array
          const fileData = new Uint8Array(entry.getData())
          await fs.writeFile(targetPath, fileData)

          extractedFiles++
          log.debug(`已解压文件 ${extractedFiles}: ${relativePath} (${fileData.length} bytes)`)
        } catch (error) {
          log.error(`解压文件失败 ${relativePath}:`, error)
          throw error
        }
      }

      log.info(`成功解压 ${extractedFiles} 个文件到 ${installDir}`)

      // 加载插件信息
      await this.loadPluginInfo(manifest.id)

      // 自动启用
      if (options.autoEnable) {
        await this.activatePlugin(manifest.id)
      }

      log.info(`插件 ${manifest.id} 安装成功`)
      eventBus.emit(
        'plugin:installed',
        { pluginId: manifest.id, activate: !!options.autoEnable },
        { source: 'PluginManager' }
      )

      options.onProgress?.(100, '安装完成')
    } catch (error) {
      log.error('解压安装插件失败:', error)
      throw error
    }
  }

  /**
   * 卸载插件
   */
  public async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      const pluginInfo = this.plugins.get(pluginId)
      if (!pluginInfo) {
        throw new Error(`插件 ${pluginId} 不存在`)
      }

      // 如果插件已启用，先停用
      if (pluginInfo.status === PluginStatus.ENABLED) {
        await this.deactivatePlugin(pluginId)
      }

      // 删除插件文件
      await fs.rm(pluginInfo.installPath, { recursive: true, force: true })

      // 从内存中移除
      this.plugins.delete(pluginId)
      this.loadedModules.delete(pluginId)

      // 清理插件数据
      await PluginDBManager.removePlugin(pluginId)

      ipcManager.send('plugin:update-all-plugins', this.getSerializablePlugins())
      ipcManager.send('plugin:update-plugin-stats', this.getPluginStats())

      log.info(`插件 ${pluginId} 卸载成功`)
      eventBus.emit(
        'plugin:uninstalled',
        { pluginId, removeData: false },
        { source: 'PluginManager' }
      )
    } catch (error) {
      log.error(`卸载插件 ${pluginId} 失败:`, error)
      throw error
    }
  }

  /**
   * 搜索插件
   */
  /**
   * 搜索本地已安装插件
   * @param options 搜索选项
   */
  public searchPlugins(options: PluginSearchOptions = {}): PluginInfo[] {
    let results = Array.from(this.plugins.values())

    // 按关键词过滤
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase()
      results = results.filter(
        (plugin) =>
          plugin.manifest.name.toLowerCase().includes(keyword) ||
          plugin.manifest.description.toLowerCase().includes(keyword) ||
          (plugin.manifest.author || '').toLowerCase().includes(keyword) ||
          plugin.manifest.keywords?.some((k) => k.toLowerCase().includes(keyword))
      )
    }

    // 按分类过滤
    if (options.category && options.category !== 'all') {
      results = results.filter((plugin) => plugin.manifest.category === options.category)
    }

    // 按状态过滤
    if (options.status) {
      results = results.filter((plugin) => plugin.status === options.status)
    }

    // 排序
    if (options.sort) {
      const { sort, order = 'asc' } = options

      results.sort((a, b) => {
        let comparison = 0
        switch (sort) {
          case 'name':
            comparison = a.manifest.name.localeCompare(b.manifest.name)
            break
          case 'status':
            comparison = a.status.localeCompare(b.status)
            break
          case 'category':
            comparison = (a.manifest.category || '').localeCompare(b.manifest.category || '')
            break
          case 'author':
            comparison = (a.manifest.author || '').localeCompare(b.manifest.author || '')
            break
          case 'date':
            comparison = new Date(a.installTime).getTime() - new Date(b.installTime).getTime()
            break
          default:
            comparison = a.manifest.name.localeCompare(b.manifest.name)
        }

        // 应用排序顺序
        return order === 'asc' ? comparison : -comparison
      })
    }

    return results
  }

  /**
   * 获取插件信息
   */
  public getPlugin(pluginId: string): PluginInfo | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * 获取所有插件
   */
  public getAllPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取序列化的插件数据（用于IPC通信）
   */
  public getSerializablePlugins(): Omit<PluginInfo, 'instance'>[] {
    return Array.from(this.plugins.values()).map((plugin) => ({
      manifest: plugin.manifest,
      status: plugin.status,
      installPath: plugin.installPath,
      installTime: plugin.installTime,
      lastUpdateTime: plugin.lastUpdateTime,
      error: plugin.error
    }))
  }

  /**
   * 获取序列化的插件信息（用于IPC通信）
   */
  public getSerializablePlugin(pluginId: string): Omit<PluginInfo, 'instance'> | undefined {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return undefined

    return {
      manifest: plugin.manifest,
      status: plugin.status,
      installPath: plugin.installPath,
      installTime: plugin.installTime,
      lastUpdateTime: plugin.lastUpdateTime,
      error: plugin.error
    }
  }

  /**
   * 更新插件状态
   */
  private updatePluginStatus(pluginId: string, status: PluginStatus, error?: string): void {
    const pluginInfo = this.plugins.get(pluginId)
    if (pluginInfo) {
      pluginInfo.status = status
      if (error) {
        pluginInfo.error = error
        // 发送插件错误事件
        eventBus.emit(
          'plugin:error',
          {
            pluginId,
            error,
            context: 'status update',
            canRecover: true
          },
          { source: 'PluginManager' }
        )
      } else {
        delete pluginInfo.error
      }
      ipcManager.send('plugin:update-all-plugins', this.getSerializablePlugins())
      ipcManager.send('plugin:update-plugin-stats', this.getPluginStats())
    }
  }

  /**
   * 初始化插件注册表
   */
  private initializeRegistries(): void {
    this.registries = [
      {
        name: 'Official Registry',
        url: 'https://plugins.vnite.app/registry',
        enabled: true
      }
    ]
  }

  /**
   * 添加插件注册表
   */
  public addRegistry(registry: PluginRegistry): void {
    this.registries.push(registry)
  }

  /**
   * 移除插件注册表
   */
  public removeRegistry(url: string): void {
    this.registries = this.registries.filter((r) => r.url !== url)
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    // 停用所有插件
    const enabledPlugins = Array.from(this.plugins.values()).filter(
      (plugin) => plugin.status === PluginStatus.ENABLED
    )

    for (const plugin of enabledPlugins) {
      try {
        await this.deactivatePlugin(plugin.manifest.id, true)
      } catch (error) {
        log.error(`停用插件 ${plugin.manifest.id} 失败:`, error)
      }
    }

    this.plugins.clear()
    this.loadedModules.clear()
  }
}

// 导出单例实例
export const pluginManager = PluginManager.getInstance()
