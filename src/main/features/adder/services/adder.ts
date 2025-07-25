import { GameDBManager, ConfigDBManager } from '~/core/database'
import { scraperManager } from '~/features/scraper'
import { selectPathDialog, getSubfoldersByDepth } from '~/utils'
import { generateUUID } from '@appUtils'
import { launcherPreset } from '~/features/launcher'
import { saveGameIconByFile } from '~/features/game'
import { DEFAULT_GAME_VALUES, DEFAULT_GAME_LOCAL_VALUES, BatchGameInfo } from '@appTypes/models'
import { eventBus } from '~/core/events'
import { GameDescriptionList, GameExtraInfoList, GameMetadata, GameTagsList } from '@appTypes/utils'

/**
 * Add a game to the database
 * @param dataSource - The data source of the game
 * @param id - The ID of the game
 * @param dbId - The ID of the game in the database
 * @param screenshotUrl - The URL of the screenshot of the game
 * @param playingTime - The playing time of the game
 * @returns void
 */
export async function addGameToDB({
  dataSource,
  dataSourceId,
  backgroundUrl,
  playTime,
  dirPath
}: {
  dataSource: string
  dataSourceId: string
  backgroundUrl?: string
  playTime?: number
  dirPath?: string
}): Promise<void> {
  const dbId = generateUUID()

  // 获取数据源能力信息
  const providerInfo = scraperManager.getProviderInfo(dataSource)
  const providerCapabilities = providerInfo?.capabilities || []

  // 首先获取基础元数据
  const baseMetadata = await scraperManager.getGameMetadata(dataSource, {
    type: 'id',
    value: dataSourceId
  })

  // 创建一个深拷贝的元数据对象，用于后续增强
  const metadata = JSON.parse(JSON.stringify(baseMetadata)) as GameMetadata

  // 准备获取缺失数据的任务
  const enhancementTasks: Promise<any>[] = []

  // 检查并获取缺失的描述信息
  if (!metadata.description || metadata.description.trim() === '') {
    enhancementTasks.push(
      scraperManager
        .getGameDescriptionList?.({
          type: 'name',
          value: metadata.originalName || metadata.name
        })
        .catch((err) => {
          console.warn(`获取游戏描述失败: ${err.message}`)
          return []
        })
    )
  } else {
    enhancementTasks.push(Promise.resolve(null))
  }

  // 检查并获取缺失的标签信息
  if (!metadata.tags || metadata.tags.length === 0) {
    enhancementTasks.push(
      scraperManager
        .getGameTagsList?.({
          type: 'name',
          value: metadata.originalName || metadata.name
        })
        .catch((err) => {
          console.warn(`获取游戏标签失败: ${err.message}`)
          return []
        })
    )
  } else {
    enhancementTasks.push(Promise.resolve(null))
  }

  // 检查并获取缺失的额外信息
  if (!metadata.extra || Object.keys(metadata.extra).length === 0) {
    enhancementTasks.push(
      scraperManager
        .getGameExtraInfoList?.({
          type: 'name',
          value: metadata.originalName || metadata.name
        })
        .catch((err) => {
          console.warn(`获取游戏额外信息失败: ${err.message}`)
          return {}
        })
    )
  } else {
    enhancementTasks.push(Promise.resolve(null))
  }

  // 执行所有增强元数据的任务
  const [descriptions, tags, extra] = (await Promise.all(enhancementTasks)) as [
    GameDescriptionList,
    GameTagsList,
    GameExtraInfoList
  ]

  // 合并增强的元数据
  if (descriptions && descriptions.length > 0) {
    metadata.description = descriptions[0].description
  }

  if (tags && tags.length > 0) {
    metadata.tags = tags[0].tags
  }

  if (extra && Object.keys(extra).length > 0) {
    metadata.extra = extra[0].extra
  }

  // 准备游戏文档
  const gameDoc = JSON.parse(JSON.stringify(DEFAULT_GAME_VALUES))
  gameDoc._id = dbId
  gameDoc.metadata = {
    ...gameDoc.metadata,
    ...metadata,
    originalName: metadata.originalName ?? '',
    [`${dataSource}Id`]: dataSourceId
  }

  if (playTime) {
    gameDoc.record.playTime = playTime
  }
  gameDoc.record.addDate = new Date().toISOString()

  const gameLocalDoc = JSON.parse(JSON.stringify(DEFAULT_GAME_LOCAL_VALUES))
  gameLocalDoc._id = dbId
  gameLocalDoc.utils.markPath = dirPath ?? ''

  // 准备图像获取任务
  // 使用显式类型注解来允许动态添加属性
  const imagePromises: {
    covers: Promise<string[]>
    backgrounds: Promise<string[]>
    icons?: Promise<string[]>
    logos?: Promise<string[]>
  } = {
    covers: scraperManager
      .getGameCovers(dataSource, { type: 'id', value: dataSourceId })
      .catch((err) => {
        console.warn(`获取游戏封面失败: ${err.message}`)
        return []
      }),
    backgrounds: !backgroundUrl
      ? scraperManager
          .getGameBackgrounds(dataSource, { type: 'id', value: dataSourceId })
          .catch((err) => {
            console.warn(`获取游戏背景失败: ${err.message}`)
            return []
          })
      : Promise.resolve([])
  }

  // 检查数据源是否支持获取图标和徽标的能力
  const hasIconCapability = providerCapabilities.includes('getGameIcons')
  const hasLogoCapability = providerCapabilities.includes('getGameLogos')

  // 根据数据源能力选择获取图标的方式
  if (hasIconCapability) {
    // 当前数据源支持获取图标
    imagePromises.icons = scraperManager
      .getGameIcons(dataSource, {
        type: 'id',
        value: dataSourceId
      })
      .catch((err) => {
        console.warn(`获取游戏图标失败: ${err.message}`)
        return []
      })
  } else {
    // 使用备选数据源 steamgriddb 获取图标
    imagePromises.icons = scraperManager
      .getGameIcons(
        'steamgriddb',
        dataSource === 'steam'
          ? { type: 'id', value: dataSourceId }
          : { type: 'name', value: metadata.originalName || metadata.name }
      )
      .catch((err) => {
        console.warn(`获取游戏图标失败: ${err.message}`)
        return []
      })
  }

  // 根据数据源能力选择获取徽标的方式
  if (hasLogoCapability) {
    // 当前数据源支持获取徽标
    imagePromises.logos = scraperManager
      .getGameLogos(dataSource, {
        type: 'id',
        value: dataSourceId
      })
      .catch((err) => {
        console.warn(`获取游戏徽标失败: ${err.message}`)
        return []
      })
  } else {
    // 使用备选数据源 steamgriddb 获取徽标
    imagePromises.logos = scraperManager
      .getGameLogos(
        'steamgriddb',
        dataSource === 'steam'
          ? { type: 'id', value: dataSourceId }
          : { type: 'name', value: metadata.originalName || metadata.name }
      )
      .catch((err) => {
        console.warn(`获取游戏徽标失败: ${err.message}`)
        return []
      })
  }

  // 并行获取所有图片资源
  const imageResults = await Promise.all([
    imagePromises.covers,
    imagePromises.backgrounds,
    imagePromises.icons,
    imagePromises.logos
  ])

  const [covers, backgrounds, icons, logos] = imageResults

  // 准备所有数据库写入操作
  const dbPromises: Promise<unknown>[] = [
    GameDBManager.setGame(dbId, gameDoc),
    GameDBManager.setGameLocal(dbId, gameLocalDoc)
  ]

  // 准备所有图片保存操作
  if (covers.length > 0 && covers[0]) {
    dbPromises.push(GameDBManager.setGameImage(dbId, 'cover', covers[0]))
  }

  if (backgroundUrl) {
    dbPromises.push(GameDBManager.setGameImage(dbId, 'background', backgroundUrl))
  } else if (backgrounds.length > 0 && backgrounds[0]) {
    dbPromises.push(GameDBManager.setGameImage(dbId, 'background', backgrounds[0]))
  }

  if (icons.length > 0 && icons[0]) {
    dbPromises.push(GameDBManager.setGameImage(dbId, 'icon', icons[0].toString()))
  }

  if (logos.length > 0 && logos[0]) {
    dbPromises.push(GameDBManager.setGameImage(dbId, 'logo', logos[0].toString()))
  }

  // 执行所有数据库操作（并行）
  await Promise.all(dbPromises)

  // 发出事件通知应用程序的其他部分
  eventBus.emit(
    'game:added',
    {
      gameId: dbId,
      name: gameDoc.metadata.name,
      dataSource,
      metadata
    },
    { source: 'adder' }
  )
}

/**
 * Add a game to the database without metadata
 * @param gamePath - The path of the game
 * @returns void
 */
export async function addGameToDBWithoutMetadata(gamePath: string): Promise<void> {
  const dbId = generateUUID()
  const gameName = gamePath.split('\\').pop() ?? ''
  const gameDoc = JSON.parse(JSON.stringify(DEFAULT_GAME_VALUES))
  gameDoc._id = dbId
  gameDoc.record.addDate = new Date().toISOString()
  gameDoc.metadata.name = gameName
  await GameDBManager.setGame(dbId, gameDoc)

  const gameLocalDoc = JSON.parse(JSON.stringify(DEFAULT_GAME_LOCAL_VALUES))
  gameLocalDoc._id = dbId
  gameLocalDoc.path.gamePath = gamePath
  await GameDBManager.setGameLocal(dbId, gameLocalDoc)

  await launcherPreset('default', dbId)
  await saveGameIconByFile(dbId, gamePath)

  eventBus.emit(
    'game:added',
    {
      gameId: dbId,
      name: gameDoc.metadata.name
    },
    { source: 'adder' }
  )
}

/**
 * Get the data for batch game adding
 * @returns The data for batch game adding
 */
export async function getBatchGameAdderData(): Promise<BatchGameInfo[]> {
  const dirPath = await selectPathDialog(['openDirectory'])
  if (!dirPath) {
    return []
  }
  const defaultDataSource = await ConfigDBManager.getConfigValue(
    'game.scraper.common.defaultDataSource'
  )
  const games = await getSubfoldersByDepth(dirPath, 1)
  const data = games.map(async (game) => {
    return {
      dataId: generateUUID(),
      dataSource: defaultDataSource,
      name: game.name,
      id: '',
      status: ((await GameDBManager.checkGameExitsByPath(game.dirPath)) ? 'existed' : 'idle') as
        | 'existed'
        | 'idle',
      dirPath: game.dirPath
    }
  })
  return Promise.all(data)
}
