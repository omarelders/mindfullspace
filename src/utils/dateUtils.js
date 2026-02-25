export function buildDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return { year, month: month - 1, day }
}

export function formatCalendarMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatCalendarEntryLabel(dateKey) {
  const parsedDate = parseDateKey(dateKey)
  if (!parsedDate) {
    return ''
  }

  return new Date(parsedDate.year, parsedDate.month, parsedDate.day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatSecondsToTimer(totalSeconds) {
  const safeTotal = Math.max(0, totalSeconds)
  const hours = Math.floor(safeTotal / 3600)
  const minutes = Math.floor((safeTotal % 3600) / 60)
  const seconds = safeTotal % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function parseTimerValue(value) {
  const raw = value.trim()
  if (!raw) {
    return null
  }

  const parts = raw.split(':').map((part) => Number(part.trim()))
  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return null
  }

  if (parts.length === 1) {
    return Math.floor(parts[0])
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    if (seconds > 59) {
      return null
    }

    return Math.floor(minutes * 60 + seconds)
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    if (minutes > 59 || seconds > 59) {
      return null
    }

    return Math.floor(hours * 3600 + minutes * 60 + seconds)
  }

  return null
}
