import { cn } from '~/utils'
import { useGameState } from '~/hooks'
import { useNavigate } from 'react-router-dom'
import { GameImage } from '@ui/game-image'
import { generateUUID } from '@appUtils'
import { scrollToElement } from '~/utils'
import { usePositionButtonStore } from '~/components/Librarybar/PositionButton'

interface GameRankingItemProps {
  gameId: string
  rank: number
  extraInfo: string
  className?: string
}

export function GameRankingItem({
  gameId,
  rank,
  extraInfo,
  className
}: GameRankingItemProps): JSX.Element {
  const [gameName] = useGameState(gameId, 'metadata.name')
  const navigate = useNavigate()
  const setLazyloadMark = usePositionButtonStore((state) => state.setLazyloadMark)

  return (
    <div
      className={cn(
        'flex items-center space-x-4 py-2 px-3 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all rounded-lg',
        className
      )}
      onClick={() => {
        navigate(`/library/games/${gameId}/all`)
        setTimeout(() => {
          scrollToElement({
            selector: `[data-game-id="${gameId}"][data-group-id="all"]`
          })
          setTimeout(() => {
            setLazyloadMark(generateUUID())
          }, 100)
        }, 50)
      }}
    >
      <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-xs font-bold rounded-full bg-primary text-primary-foreground">
        {rank}
      </div>
      <GameImage
        gameId={gameId}
        type={'cover'}
        className="object-cover w-10 h-10 rounded-md"
        fallback={<div className="w-10 h-10 rounded-md bg-primary" />}
      />
      <div className="flex-grow min-w-0">
        <p className="text-sm font-medium truncate">{gameName}</p>
      </div>
      <div className="flex-shrink-0 text-sm text-muted-foreground">{extraInfo}</div>
    </div>
  )
}
