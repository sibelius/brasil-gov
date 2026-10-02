import { CalendarClock } from 'lucide-react'
import { useHolidays } from '../../hooks/use-holidays.ts'
import {
  BUSINESS_DAY_NOTE,
  DEADLINE_NOTE,
  estimateDeadline,
  today,
} from '../../lib/services/deadline.ts'
import type { ParsedDuration } from '../../lib/services/duration.ts'

export default function ServiceDeadline({ duration }: { duration: ParsedDuration }) {
  const holidays = useHolidays()

  if (!holidays) {
    return null
  }

  const deadline = estimateDeadline(today(), duration, holidays)

  if (deadline.kind === 'indisponivel' || deadline.kind === 'imediato') {
    return null
  }

  const note = [DEADLINE_NOTE, deadline.unit === 'dias-uteis' ? BUSINESS_DAY_NOTE : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="service-deadline">
      <p className="service-deadline-estimate">
        <CalendarClock size={13} aria-hidden="true" />
        <span>{deadline.label}</span>
      </p>
      <p className="service-deadline-note">{note}</p>
    </div>
  )
}
