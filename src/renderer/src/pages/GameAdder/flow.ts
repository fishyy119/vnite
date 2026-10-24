import i18next from 'i18next'
import { toast } from 'sonner'
import { ipcManager } from '~/app/ipc'
import { useGameMetadataUpdaterStore } from '../GameMetadataUpdater/store'
import { useGameAdderStore, type GameAdderDraft, type GameAdderState } from './store'

function addGameInBackground(draft: GameAdderDraft): void {
  const request =
    draft.dataSource === 'none'
      ? ipcManager.invoke('adder:add-game-to-db-without-metadata', draft.dirPath, draft.gamePath)
      : ipcManager.invoke('adder:add-game-to-db', {
          dataSource: draft.dataSource,
          dataSourceId: draft.dataSourceId,
          dirPath: draft.dirPath,
          gamePath: draft.gamePath,
          backgroundUrl: draft.backgroundUrl,
          upscaleEnabled: draft.enableUpscale
        })
  // The submitted request and its notification outlive the dialog session.
  toast.promise(request, {
    loading: i18next.t('adder:gameAdder.backgrounds.notifications.adding'),
    success: () => i18next.t('adder:gameAdder.backgrounds.notifications.addSuccess'),
    error: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      return message
        ? i18next.t('adder:gameAdder.backgrounds.notifications.addError', { message })
        : i18next.t('adder:gameAdder.search.notifications.addError')
    }
  })
}

function finish(state: GameAdderState): void {
  try {
    const { draft } = state
    if (draft.dbId) {
      // Updater Mode
      useGameMetadataUpdaterStore.setState({
        open: true,
        gameIds: [draft.dbId],
        dataSource: draft.dataSource,
        dataSourceId: draft.dataSourceId,
        backgroundUrl: draft.backgroundUrl,
        enableUpscale: draft.enableUpscale
      })
    } else addGameInBackground(draft)
    state.close()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(
      message
        ? i18next.t('adder:gameAdder.backgrounds.notifications.addError', { message })
        : i18next.t('adder:gameAdder.search.notifications.addError')
    )
  }
}

export const gameAdderFlow = {
  confirmCandidate(): void {
    const state = useGameAdderStore.getState()
    if (state.draft.dataSource === 'none') finish(state)
    else state.goTo('backgrounds')
  },

  confirmBackground(): void {
    const state = useGameAdderStore.getState()
    finish(state)
  }
}
