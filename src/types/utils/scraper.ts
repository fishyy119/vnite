export type GameList = {
  id: string
  name: string
  releaseDate: string
  developers: string[]
}[]

export type GameMetadata = {
  name: string
  originalName: string | null
  releaseDate: string
  description: string
  developers: string[]
  publishers?: string[]
  genres?: string[]
  platforms?: string[]
  relatedSites: {
    label: string
    url: string
  }[]
  tags: string[]
  extra?: {
    key: string
    value: string[]
  }[]
}

export type ScraperIdentifier = {
  type: 'id' | 'name'
  value: string
}

export type GameDescriptionList = {
  dataSource: string
  description: string
}[]

export type GameTagsList = {
  dataSource: string
  tags: string[]
}[]

export type GameExtraInfoList = {
  dataSource: string
  extra: {
    key: string
    value: string[]
  }[]
}[]

export type ScraperCapabilities =
  | 'searchGames'
  | 'checkGameExists'
  | 'getGameMetadata'
  | 'getGameBackgrounds'
  | 'getGameCovers'
  | 'getGameLogos'
  | 'getGameIcons'
