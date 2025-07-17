import { useGameBatchAdderStore } from './store'
import { GameListItem } from './GameListItem'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { cn } from '~/utils'
import { useTranslation } from 'react-i18next'

// eslint-disable-next-line
export const TABLE_COLUMN_WIDTHS = {
  dataSource: 'w-[150px] 3xl:w-[350px]',
  name: 'w-[300px] 3xl:w-[350px]',
  id: 'w-[150px] 3xl:w-[200px]',
  status: 'w-[120px] 3xl:w-[200px]',
  actions: 'w-[150px] 3xl:w-[200px]'
} as const

export function GameListTable(): React.JSX.Element {
  const { t } = useTranslation('adder')
  const { games } = useGameBatchAdderStore()
  // Putting games in existed status at the end
  const sortedGames = [...games].sort((a, b) => {
    if (a.status === 'existed' && b.status !== 'existed') {
      return 1
    }
    if (a.status !== 'existed' && b.status === 'existed') {
      return -1
    }
    return 0
  })

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(TABLE_COLUMN_WIDTHS.dataSource)}>
              {t('gameBatchAdder.table.columns.dataSource')}
            </TableHead>
            <TableHead className={cn(TABLE_COLUMN_WIDTHS.name)}>
              {t('gameBatchAdder.table.columns.name')}
            </TableHead>
            <TableHead className={cn(TABLE_COLUMN_WIDTHS.id)}>
              {t('gameBatchAdder.table.columns.id')}
            </TableHead>
            <TableHead className={cn(TABLE_COLUMN_WIDTHS.status)}>
              {t('gameBatchAdder.table.columns.status')}
            </TableHead>
            <TableHead className={cn(TABLE_COLUMN_WIDTHS.actions)}>
              {t('gameBatchAdder.table.columns.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <Table>
        <TableBody>
          <div className={cn('overflow-auto scrollbar-base w-full', 'h-[calc(75vh-100px)]')}>
            {sortedGames.map((game) => (
              <GameListItem key={game.dataId} game={game} />
            ))}
          </div>
        </TableBody>
      </Table>
    </>
  )
}
