import { cn } from '~/utils'
import { useGameLocalState } from '~/hooks'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { Separator } from '@ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@ui/select'
import { useTranslation } from 'react-i18next'

export function UrlLauncher({ gameId }: { gameId: string }): JSX.Element {
  const { t } = useTranslation('game')
  const [url, setUrl] = useGameLocalState(gameId, 'launcher.urlConfig.url')
  const [browserPath, setBrowserPath] = useGameLocalState(gameId, 'launcher.urlConfig.browserPath')
  const [monitorMode, setMonitorMode] = useGameLocalState(gameId, 'launcher.urlConfig.monitorMode')
  const [monitorPath, setMonitorPath] = useGameLocalState(gameId, 'launcher.urlConfig.monitorPath')

  async function selectBorwserPath(): Promise<void> {
    const workingDirectoryPath: string = await window.api.utils.selectPathDialog(
      ['openFile'],
      ['exe']
    )
    setBrowserPath(workingDirectoryPath)
  }

  async function selectMonitorPath(): Promise<void> {
    if (monitorMode === 'file') {
      const monitorPath: string = await window.api.utils.selectPathDialog(['openFile'])
      setMonitorPath(monitorPath)
    }
    if (monitorMode === 'folder') {
      const monitorPath: string = await window.api.utils.selectPathDialog(['openDirectory'])
      setMonitorPath(monitorPath)
    }
  }

  return (
    <div className={cn('grid grid-cols-[120px_1fr] gap-x-5 gap-y-5 items-center')}>
      {/* URL address */}
      <div className={cn('whitespace-nowrap select-none')}>
        {t('detail.properties.launcher.url.address')}
      </div>
      <div>
        <Input className={cn('w-full')} value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>

      {/* Browser Path */}
      <div className={cn('whitespace-nowrap select-none')}>
        {t('detail.properties.launcher.url.browser')}
      </div>
      <div className={cn('flex flex-row gap-3 items-center')}>
        <Input
          className={cn('flex-1')}
          value={browserPath}
          onChange={(e) => setBrowserPath(e.target.value)}
          placeholder={t('detail.properties.launcher.url.defaultBrowser')}
        />
        <Button variant={'outline'} size={'icon'} onClick={selectBorwserPath}>
          <span className={cn('icon-[mdi--folder-open-outline] w-5 h-5')}></span>
        </Button>
      </div>

      <div className={cn('col-span-2')}>
        <Separator />
      </div>

      {/* monitor mode */}
      <div className={cn('whitespace-nowrap select-none')}>
        {t('detail.properties.launcher.monitor.title')}
      </div>
      <div>
        <Select value={monitorMode} onValueChange={setMonitorMode}>
          <SelectTrigger className={cn('w-[120px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('detail.properties.launcher.monitor.title')}</SelectLabel>
              <SelectItem value="folder">
                {t('detail.properties.launcher.monitor.mode.folder')}
              </SelectItem>
              <SelectItem value="file">
                {t('detail.properties.launcher.monitor.mode.file')}
              </SelectItem>
              <SelectItem value="process">
                {t('detail.properties.launcher.monitor.mode.process')}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Monitor path/process name */}
      <div className={cn('whitespace-nowrap select-none')}>
        {['folder', 'file'].includes(monitorMode)
          ? t('detail.properties.launcher.monitor.path')
          : t('detail.properties.launcher.monitor.processName')}
      </div>
      <div className={cn('flex flex-row gap-3 items-center')}>
        <Input
          className={cn('flex-1')}
          value={monitorPath}
          onChange={(e) => setMonitorPath(e.target.value)}
        />
        {['folder', 'file'].includes(monitorMode) && (
          <Button variant={'outline'} size={'icon'} onClick={selectMonitorPath}>
            <span
              className={cn(
                monitorMode === 'folder'
                  ? 'icon-[mdi--folder-open-outline] w-5 h-5'
                  : 'icon-[mdi--file-outline] w-5 h-5'
              )}
            ></span>
          </Button>
        )}
      </div>
    </div>
  )
}
