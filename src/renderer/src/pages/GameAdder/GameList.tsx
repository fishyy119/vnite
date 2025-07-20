import { cn } from '~/utils'
import { Card, CardContent } from '~/components/ui/card'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '~/components/ui/table'
import { toast } from 'sonner'
import { useGameAdderStore } from './store'
import { Search } from './Search'
import { useTranslation } from 'react-i18next'

export function GameList(): React.JSX.Element {
  const { t } = useTranslation('adder')
  const { setName, dataSourceId, setDataSourceId, gameList } = useGameAdderStore()

  return (
    <div className={cn('w-[726px] h-[86vh] p-3', '3xl:w-[876px]')}>
      <div className={cn('flex flex-col w-full h-full gap-3')}>
        <Card className={cn('grow pt-3')}>
          <CardContent className="h-full w-full">
            <div className="w-full">
              <ScrollArea className={cn('h-[calc(84vh-230px)] pr-3')}>
                <Table>
                  <TableHeader className={cn('')}>
                    <TableRow>
                      <TableHead className={cn('w-1/2')}>
                        {t('gameAdder.gameList.columns.name')}
                      </TableHead>
                      <TableHead className={cn('w-1/4')}>
                        {t('gameAdder.gameList.columns.releaseDate')}
                      </TableHead>
                      <TableHead className={cn('w-1/4')}>
                        {t('gameAdder.gameList.columns.developers')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameList.map((game) => (
                      <TableRow
                        key={game.name}
                        onClick={() => {
                          setDataSourceId(game.id)
                          setName(game.name)
                          toast.success(t('gameAdder.gameList.selected', { name: game.name }))
                        }}
                        className={cn(
                          'cursor-pointer',
                          game.id === dataSourceId
                            ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                            : ''
                        )}
                      >
                        <TableCell>
                          <div className={cn('w-[300px] truncate', '3xl:w-[350px]')}>
                            {game.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={cn('w-[150px] truncate', '3xl:w-[200px]')}>
                            {game.releaseDate === ''
                              ? t('gameAdder.gameList.unknown')
                              : game.releaseDate}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={cn('w-[150px] truncate', '3xl:w-[200px]')}>
                            {game.developers.join(', ') === ''
                              ? t('gameAdder.gameList.unknown')
                              : game.developers.join(', ')}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <Search className={cn('w-full p-5 text-sm', '3xl:w-full')} />
        </Card>
      </div>
    </div>
  )
}
