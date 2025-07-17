export interface GetOwnedGamesResponse {
  response: {
    game_count: number
    games: Array<{
      appid: number
      name: string
      playtime_2weeks?: number
      playtime_forever: number
    }>
  }
}

// Type Definitions for Progress Messages
export interface ProgressMessage {
  current: number
  total: number
  status: 'started' | 'processing' | 'completed' | 'error'
  message: string
  game?: {
    name: string
    status: 'success' | 'error'
    error?: string
  }
}
