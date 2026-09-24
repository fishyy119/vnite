import type { GameSortField } from '@appTypes/models'

export const GAME_SORT_FIELDS: readonly GameSortField[] = [
  'metadata.name',
  'metadata.sortName',
  'metadata.releaseDate',
  'record.lastRunDate',
  'record.addDate',
  'record.playTime',
  'record.score',
  'record.storageSize',
  'record.playStatus'
]
