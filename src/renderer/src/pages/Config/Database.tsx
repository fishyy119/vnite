import { cn, ipcSend } from '~/utils'
import { Card, CardContent } from '@ui/card'
import { Separator } from '@ui/separator'
import { Button } from '@ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@ui/alert-dialog'
import { Switch } from '@ui/switch'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function Database(): JSX.Element {
  const { t } = useTranslation('config')
  const [isPortable, setIsPortable] = useState<boolean>(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [switchDialogOpen, setSwitchDialogOpen] = useState<boolean>(false)

  useEffect(() => {
    window.api.utils.isPortableMode().then((isPortable) => {
      setIsPortable(isPortable as boolean)
    })

    window.api.utils.checkAdminPermissions().then((hasAdminRights) => {
      setIsAdmin(hasAdminRights as boolean)
    })
  }, [])

  const backup = async (): Promise<void> => {
    toast.promise(
      async () => {
        const targetPath: string = await window.api.utils.selectPathDialog(['openDirectory'])
        if (!targetPath) return
        await window.api.database.backupDatabase(targetPath)
      },
      {
        loading: t('database.notifications.backingUp'),
        success: t('database.notifications.backupSuccess'),
        error: t('database.notifications.backupError')
      }
    )
  }

  const restore = async (): Promise<void> => {
    toast.promise(
      async () => {
        const sourcePath: string = await window.api.utils.selectPathDialog(['openFile'])
        if (!sourcePath) return
        await window.api.database.restoreDatabase(sourcePath)
      },
      {
        loading: t('database.notifications.importing'),
        success: t('database.notifications.importSuccess'),
        error: t('database.notifications.importError')
      }
    )
  }

  const importV2Data = async (): Promise<void> => {
    toast.promise(
      async () => {
        const sourcePath: string = await window.api.utils.selectPathDialog(['openFile'])
        if (!sourcePath) return
        await window.api.importer.importV2Data(sourcePath)
      },
      {
        loading: t('database.notifications.importing'),
        success: t('database.notifications.importSuccess'),
        error: t('database.notifications.importError')
      }
    )
  }

  const handleSwitchClick = async (): Promise<void> => {
    // If you want to switch to portable mode but do not have administrator permissions
    if (!isPortable && !isAdmin) {
      const isNeedAdminRights = await window.api.utils.checkIfPortableDirectoryNeedsAdminRights()
      if (isNeedAdminRights) {
        toast.error(t('database.notifications.adminRightsRequired'))
        return
      }
    }
    // Open the confirmation dialog
    setSwitchDialogOpen(true)
  }

  const switchDatabaseMode = async (): Promise<void> => {
    toast.promise(
      async () => {
        await window.api.utils.switchDatabaseMode()
        setIsPortable((prev) => !prev)
        toast.info(t('database.notifications.restartCountdown'))
        setTimeout(() => {
          ipcSend('relaunch-app')
        }, 3000)
      },
      {
        loading: t('database.notifications.switchingMode'),
        success: t('database.notifications.switchSuccess'),
        error: t('database.notifications.switchError')
      }
    )
  }

  return (
    <Card className={cn('group')}>
      <CardContent>
        <div className={cn('space-y-5 w-full')}>
          {/* Portable mode toggle */}
          <div className={cn('grid grid-cols-[1fr_auto] gap-5 items-center')}>
            <div className={cn('whitespace-nowrap select-none')}>{t('database.portableMode')}</div>
            <Switch
              checked={isPortable}
              onClick={handleSwitchClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSwitchClick()
                }
              }}
            />
            <AlertDialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('database.confirmSwitch', {
                      mode: isPortable ? t('database.modes.normal') : t('database.modes.portable')
                    })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {!isPortable && (
                      <>
                        {t('database.portableAdminRequired')}
                        <br />
                      </>
                    )}
                    {t('database.switchDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('utils:common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={switchDatabaseMode}>
                    {t('utils:common.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Separator/>

          {/* Various buttons */}
          <div className={cn('grid grid-cols-1 gap-5 select-none')}>
            <div className={cn('flex flex-row gap-5 items-center')}>
              <Button
                variant={'outline'}
                onClick={async () => {
                  await window.api.utils.openDatabasePathInExplorer()
                }}
              >
                {t('database.openFolder')}
              </Button>
            </div>

            <div className={cn('flex flex-row gap-5 items-center')}>
              <Button onClick={backup}>{t('database.backup')}</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>{t('database.import')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('database.confirmImport')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('database.importWarning')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('utils:common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={restore}>
                      {t('utils:common.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className={cn('flex flex-row gap-5 items-center')}>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={'outline'}>{t('database.importV2')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('database.confirmImportV2')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('database.importV2Warning')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('utils:common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={importV2Data}>
                      {t('utils:common.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
