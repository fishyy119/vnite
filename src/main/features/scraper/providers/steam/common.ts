import { GameList, GameMetadata } from '@appTypes/utils'
import { SteamAppDetailsResponse, SteamStoreSearchResponse, SteamLanguageConfig } from './types'
import { formatDate } from '~/utils'
import i18next from 'i18next'
import { net } from 'electron'

// 定义基础 URL 常量
const STEAM_URLS = {
  STORE: 'https://store.steampowered.com',
  CDN: 'https://steamcdn-a.akamaihd.net',
  COMMUNITY: 'https://steamcommunity.com',
  CLOUDFLARE: 'https://cdn.cloudflare.steamstatic.com'
}

// 通用的 fetch 函数
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await net.fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

async function fetchSteamAPI(url: string): Promise<any> {
  const response = await fetchWithTimeout(url)
  return response.json()
}

export async function searchSteamGames(gameName: string): Promise<GameList> {
  try {
    const langConfig = i18next.t('scraper:steam.config', {
      returnObjects: true
    }) as SteamLanguageConfig

    const url = `${STEAM_URLS.STORE}/api/storesearch/?term=${encodeURIComponent(
      gameName
    )}&l=${langConfig.apiLanguageCode}&cc=${langConfig.countryCode}`

    const response = (await fetchSteamAPI(url)) as SteamStoreSearchResponse

    if (!response.items || response.items.length === 0) {
      throw new Error('No games found')
    }

    const gamesMetadata = await Promise.all(
      response.items.map((game) =>
        getSteamMetadata(game.id.toString()).catch((error) => {
          console.error(`Error fetching metadata for game ${game.id}:`, error)
          return {
            releaseDate: '',
            developers: [] as string[]
          }
        })
      )
    )

    return response.items.map((game, index) => ({
      id: game.id.toString(),
      name: game.name,
      releaseDate: gamesMetadata[index].releaseDate,
      developers: gamesMetadata[index].developers
    }))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'No games found') {
        return []
      }
      console.error('Error fetching Steam games:', error.message)
      throw error
    }
    throw new Error('An unknown error occurred')
  }
}

async function fetchStoreTags(appId: string): Promise<string[]> {
  try {
    const langConfig = i18next.t('scraper:steam.config', {
      returnObjects: true
    }) as SteamLanguageConfig

    const url = `${STEAM_URLS.STORE}/app/${appId}`

    const response = await fetchWithTimeout(url, {
      headers: {
        'Accept-Language': langConfig.acceptLanguageHeader
      }
    })

    const html = await response.text()

    // 简单的基于正则表达式的标签提取方法
    const tagMatches = html.match(/class="app_tag"[^>]*>([^<]+)<\/a>/g) || []
    const tags: string[] = []

    tagMatches.forEach((match) => {
      const tagMatch = match.match(/>([^<]+)<\/a>/)
      if (tagMatch && tagMatch[1]) {
        const tag = tagMatch[1].trim()
        if (tag && tag !== '+') {
          tags.push(tag)
        }
      }
    })

    return tags
  } catch (error) {
    console.error('Error fetching store tags:', error)
    return []
  }
}

export async function getSteamMetadata(appId: string): Promise<GameMetadata> {
  try {
    const langConfig = i18next.t('scraper:steam.config', {
      returnObjects: true
    }) as SteamLanguageConfig

    // 获取当前语言的数据
    const urlLocal = `${STEAM_URLS.STORE}/api/appdetails?appids=${appId}&l=${langConfig.apiLanguageCode}`

    // 判断是否需要获取英文原名（如果当前语言不是英文）
    const needsOriginalName = langConfig.apiLanguageCode !== 'english'

    let localData: SteamAppDetailsResponse
    let englishData: SteamAppDetailsResponse | null = null

    if (needsOriginalName) {
      // 并行获取本地语言和英文数据
      ;[localData, englishData] = await Promise.all([
        fetchSteamAPI(urlLocal),
        fetchSteamAPI(`${STEAM_URLS.STORE}/api/appdetails?appids=${appId}&l=english`)
      ])
    } else {
      // 只获取一种语言
      localData = await fetchSteamAPI(urlLocal)
      englishData = localData // 如果当前语言是英文，重用
    }

    if (!localData[appId].success) {
      throw new Error(`No game found with ID: ${appId}`)
    }

    const gameData = localData[appId].data
    const originalName =
      englishData && englishData[appId].success ? englishData[appId].data.name : gameData.name

    const tags = await fetchStoreTags(appId)

    return {
      name: gameData.name,
      originalName,
      releaseDate: formatDate(gameData?.release_date?.date || ''),
      description:
        gameData.detailed_description ||
        gameData.about_the_game ||
        gameData.short_description ||
        '',
      developers: gameData.developers || [],
      publishers: gameData.publishers,
      genres: gameData.genres?.map((genre) => genre.description) || [],
      relatedSites: [
        ...(gameData.website
          ? [{ label: i18next.t('scraper:steam.officialWebsite'), url: gameData.website }]
          : []),
        ...(gameData.metacritic?.url
          ? [{ label: 'Metacritic', url: gameData.metacritic.url }]
          : []),
        {
          label: i18next.t('scraper:steam.steamStore'),
          url: `${STEAM_URLS.STORE}/app/${appId}`
        }
      ],
      tags: tags.length > 0 ? tags : gameData.genres?.map((genre) => genre.description) || []
    }
  } catch (error) {
    console.error(`Error fetching metadata for game ${appId}:`, error)
    throw error
  }
}

export async function getSteamMetadataByName(gameName: string): Promise<GameMetadata> {
  try {
    const games = await searchSteamGames(gameName)
    if (games.length === 0) {
      return {
        name: gameName,
        originalName: gameName,
        releaseDate: '',
        description: '',
        developers: [],
        relatedSites: [],
        tags: []
      }
    }
    return await getSteamMetadata(games[0].id)
  } catch (error) {
    console.error(`Error fetching metadata for game ${gameName}:`, error)
    throw error
  }
}

/**
 * 检查图片 URL 是否存在
 * @param url 需要检查的图片 URL
 * @returns 如果图片存在则返回 true，否则返回 false
 */
export async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await net.fetch(url, {
      method: 'HEAD' // 只获取头信息，不下载实际图片内容
    })

    // 检查状态码是否为 200
    return response.status === 200
  } catch (error) {
    console.error(`检查图片失败: ${url}`, error)
    return false
  }
}

/**
 * 获取游戏背景图片 URL
 * @param appId Steam 应用 ID
 * @returns 可用的背景图片 URL
 */
export async function getGameBackground(appId: string): Promise<string> {
  const hdUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/library_hero_2x.jpg`
  const standardUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/library_hero.jpg`

  // 检查高清图片是否存在
  const hdExists = await checkImageExists(hdUrl)

  // 如果高清图片存在，返回高清图片 URL，否则返回标准图片 URL
  return hdExists ? hdUrl : standardUrl
}

/**
 * 获取游戏封面图片 URL
 * @param appId Steam 应用 ID
 * @returns 可用的封面图片 URL
 */
export async function getGameCover(appId: string): Promise<string> {
  const hdUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/library_600x900_2x.jpg`
  const standardUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/library_600x900.jpg`

  // 检查高清图片是否存在
  const hdExists = await checkImageExists(hdUrl)

  // 如果高清图片存在，返回高清图片 URL，否则返回标准图片 URL
  return hdExists ? hdUrl : standardUrl
}

/**
 * 获取游戏 Logo URL
 * @param appId Steam 应用 ID
 * @returns 可用的 Logo 图片 URL
 */
export async function getGameLogo(appId: string): Promise<string> {
  const hdUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/logo_2x.png`
  const standardUrl = `${STEAM_URLS.CDN}/steam/apps/${appId}/logo.png`

  // 检查高清图片是否存在
  const hdExists = await checkImageExists(hdUrl)

  // 如果高清图片存在，返回高清图片 URL，否则返回标准图片 URL
  return hdExists ? hdUrl : standardUrl
}

export async function checkSteamGameExists(appId: string): Promise<boolean> {
  try {
    const url = `${STEAM_URLS.STORE}/api/appdetails?appids=${appId}`
    const data = (await fetchSteamAPI(url)) as SteamAppDetailsResponse
    return data[appId]?.success || false
  } catch (error) {
    console.error(`Error checking game existence for ID ${appId}:`, error)
    throw error
  }
}

export async function getGameCoverByName(gameName: string): Promise<string> {
  try {
    const games = await searchSteamGames(gameName)
    if (games.length === 0) return ''
    return getGameCover(games[0].id)
  } catch (error) {
    console.error(`Error fetching cover for game ${gameName}:`, error)
    return ''
  }
}

export async function getGameBackgroundByName(gameName: string): Promise<string> {
  try {
    const games = await searchSteamGames(gameName)
    if (games.length === 0) return ''
    return getGameBackground(games[0].id)
  } catch (error) {
    console.error(`Error fetching screenshots for game ${gameName}:`, error)
    return ''
  }
}

export async function getGameLogoByName(gameName: string): Promise<string> {
  try {
    const games = await searchSteamGames(gameName)
    if (games.length === 0) return ''
    return getGameLogo(games[0].id)
  } catch (error) {
    console.error(`Error fetching logo for game ${gameName}:`, error)
    return ''
  }
}
