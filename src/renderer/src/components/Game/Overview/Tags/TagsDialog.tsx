import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog'
import { cn } from '~/utils'
import { useGameState } from '~/hooks'
import { ArrayInput } from '~/components/ui/array-input'

export function TagsDialog({ gameId }: { gameId: string }): React.JSX.Element {
  const { t } = useTranslation('game')
  const [tags, setTags, saveTags] = useGameState(gameId, 'metadata.tags', true)

  return (
    <Dialog>
      <DialogTrigger>
        <span
          className={cn('invisible group-hover:visible w-5 h-5 icon-[mdi--square-edit-outline]')}
        ></span>
      </DialogTrigger>
      <DialogContent className={cn('w-[500px] h-[300px] max-w-none flex flex-col gap-5')}>
        <div className={cn('text-xs -mb-2')}>{t('detail.overview.tags.separator')}</div>
        <ArrayInput
          className={cn('grow resize-none')}
          value={tags}
          onChange={setTags}
          onBlur={saveTags}
          placeholder={t('detail.overview.tags.empty')}
          isTextarea
          isHaveTooltip={false}
        />
      </DialogContent>
    </Dialog>
  )
}
