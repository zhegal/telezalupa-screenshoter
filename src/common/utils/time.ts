export function formatTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});

  return {
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function formatDateParts(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});

  return `${parts.day}.${parts.month}.${parts.year}`;
}

export function getLocalMinutes(date: Date, timeZone: string): number {
  const parts = formatTimeParts(date, timeZone);

  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function isNowInsideInterval(
  nowMinutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}
