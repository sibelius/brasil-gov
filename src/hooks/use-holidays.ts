import { useEffect, useState } from 'react'
import { loadHolidays } from '../lib/services/repository.ts'
import type { HolidayCalendar } from '../lib/services/holidays.ts'

let shared: Promise<HolidayCalendar> | undefined

function holidays() {
  shared ??= loadHolidays().catch((error: unknown) => {
    shared = undefined

    throw error
  })

  return shared
}

/**
 * The holiday calendar, or undefined while it loads or when it fails. A missing
 * calendar only hides the estimated date; the published deadline still shows.
 */
export function useHolidays(): HolidayCalendar | undefined {
  const [calendar, setCalendar] = useState<HolidayCalendar>()

  useEffect(() => {
    let active = true

    holidays().then(
      (value) => {
        if (active) {
          setCalendar(value)
        }
      },
      () => undefined,
    )

    return () => {
      active = false
    }
  }, [])

  return calendar
}
