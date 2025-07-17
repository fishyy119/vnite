import {
  getGameCover,
  getGameCoverByName,
  getSteamMetadata,
  getSteamMetadataByName,
  checkSteamGameExists,
  searchSteamGames,
  getGameLogo,
  getGameLogoByName,
  getGameBackground,
  getGameBackgroundByName
} from './common'
import { GameList, GameMetadata, ScraperIdentifier } from '@appTypes/utils'
import log from 'electron-log/main.js'

/**
 * Search for games on Steam
 * @param gameName The name of the game to search for
 * @returns A list of games
 * @throws An error if the operation fails
 */
export async function searchGamesFromSteam(gameName: string): Promise<GameList> {
  try {
    const games = await searchSteamGames(gameName)
    return games
  } catch (error) {
    log.error('Error searching for games:', error)
    throw error
  }
}

/**
 * Get game metadata from Steam
 * @param identifier The identifier of the game
 * @returns The metadata for the game
 * @throws An error if the operation fails
 */
export async function getGameMetadataFromSteam(
  identifier: ScraperIdentifier
): Promise<GameMetadata> {
  try {
    const metadata =
      identifier.type === 'id'
        ? await getSteamMetadata(identifier.value)
        : await getSteamMetadataByName(identifier.value)
    return metadata
  } catch (error) {
    log.error('Error fetching game metadata:', error)
    throw error
  }
}

/**
 * Check if a game exists on Steam
 * @param appId The app id of the game on Steam
 * @returns A boolean indicating if the game exists
 * @throws An error if the operation fails
 */
export async function checkGameExistsOnSteam(appId: string): Promise<boolean> {
  try {
    const exists = await checkSteamGameExists(appId)
    return exists
  } catch (error) {
    log.error('Error checking if game exists:', error)
    throw error
  }
}

/**
 * Get game backgrounds from Steam
 * @param identifier The identifier of the game
 * @returns A list of backgrounds
 * @throws An error if the operation fails
 */
export async function getGameBackgroundsFromSteam(
  identifier: ScraperIdentifier
): Promise<string[]> {
  try {
    const background =
      identifier.type === 'id'
        ? await getGameBackground(identifier.value)
        : await getGameBackgroundByName(identifier.value)
    return background ? [background] : []
  } catch (error) {
    log.error('Error fetching game backgrounds:', error)
    return []
  }
}

/**
 * Get the cover of the game from Steam
 * @param identifier The identifier of the game
 * @returns The cover of the game
 * @throws An error if the operation fails
 */
export async function getGameCoversFromSteam(identifier: ScraperIdentifier): Promise<string[]> {
  try {
    const cover =
      identifier.type === 'id'
        ? await getGameCover(identifier.value)
        : await getGameCoverByName(identifier.value)
    return cover ? [cover] : []
  } catch (error) {
    log.error('Error fetching game cover:', error)
    return []
  }
}

/**
 * Get the logo of the game from Steam
 * @param identifier The identifier of the game
 * @returns The logo of the game
 * @throws An error if the operation fails
 */
export async function getGameLogosFromSteam(identifier: ScraperIdentifier): Promise<string[]> {
  try {
    const logo =
      identifier.type === 'id'
        ? await getGameLogo(identifier.value)
        : await getGameLogoByName(identifier.value)
    return logo ? [logo] : []
  } catch (error) {
    log.error('Error fetching game logo:', error)
    return []
  }
}
