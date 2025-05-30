import { DateInput } from '@ui/date-input'
import { Separator } from '@ui/separator'
import { cn } from '~/utils'
import { getGamePlayTimeByDateRange, getGameStartAndEndDate } from '~/stores/game'
import { useState, useEffect } from 'react'
import { TimerChart } from './TimerChart'
import { isEqual } from 'lodash'
import { useTranslation } from 'react-i18next'

export function ChartCard({
  gameId,
  className = ''
}: {
  gameId: string
  className?: string
}): JSX.Element {
  const { t } = useTranslation('game')
  const timers = getGameStartAndEndDate(gameId)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [playTimeByDateRange, setPlayTimeByDateRange] = useState<Record<string, number>>({})

  useEffect(() => {
    setStartDate(timers.start)
    setEndDate(timers.end)
  }, [timers.start, timers.end])

  const isDateInRange = (date: string): boolean => {
    if (!date || !timers.start || !timers.end) return false
    return date >= timers.start && date <= timers.end
  }

  useEffect(() => {
    // Get data only if both dates are valid and within the allowed range
    if (
      startDate &&
      endDate &&
      isDateInRange(startDate) &&
      isDateInRange(endDate) &&
      startDate <= endDate
    ) {
      const data = getGamePlayTimeByDateRange(gameId, startDate, endDate)
      setPlayTimeByDateRange(data)
    }
  }, [startDate, endDate, timers.start, timers.end, gameId])

  return (
    <div className={cn(className, 'flex flex-col')}>
      <div className={cn('font-bold')}>{t('detail.chart.title')}</div>
      <Separator className={cn('my-3 bg-primary')} />
      {!isEqual(timers, { start: '', end: '' }) ? (
        <>
          <div className={cn('flex flex-row gap-2 items-center')}>
            <DateInput
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn('')}
            />
            <div>-</div>
            <DateInput
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn('')}
            />
          </div>
          {!startDate || !endDate ? (
            t('detail.chart.selectRange')
          ) : startDate > endDate ? (
            <div>{t('detail.chart.dateError')}</div>
          ) : !isDateInRange(startDate) || !isDateInRange(endDate) ? (
            <div>
              {t('detail.chart.rangeLimit', { startDate: timers.start, endDate: timers.end })}
            </div>
          ) : (
            <div className={cn('max-h-full rounded-lg py-3', '3xl:max-h-full')}>
              <TimerChart data={playTimeByDateRange} className={cn('w-full max-h-[30vh] -ml-3')} />
            </div>
          )}
        </>
      ) : (
        <div>{t('detail.chart.noData')}</div>
      )}
    </div>
  )
}
