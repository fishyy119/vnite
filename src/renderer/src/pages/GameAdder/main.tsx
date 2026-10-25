import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog'
import { BackgroundList } from './BackgroundList'
import { DuplicateReview } from './DuplicateReview'
import { Search } from './Search'
import { useGameAdderStore } from './store'

export function GameAdder(): React.JSX.Element {
  const { isOpen, currentPage, close } = useGameAdderStore()
  const { t } = useTranslation('adder')

  const renderPage = (): React.JSX.Element => {
    switch (currentPage) {
      case 'search':
        return <Search />
      case 'review':
        return <DuplicateReview />
      case 'backgrounds':
        return <BackgroundList />
    }
  }

  return (
    <Dialog open={isOpen}>
      {isOpen && (
        <DialogContent
          className="flex h-auto w-auto max-w-none flex-col gap-5 outline-none"
          onClose={close}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            close()
          }}
        >
          {currentPage !== 'review' && (
            <DialogTitle className="sr-only">{t('gameAdder.dialog.title')}</DialogTitle>
          )}
          {renderPage()}
        </DialogContent>
      )}
    </Dialog>
  )
}
