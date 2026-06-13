export type ChannelTimezone = [string, string];

export interface ChannelAvailableInterval {
  start: string;
  end: string;
}

export interface Channel {
  title: string;
  url: string;
  description: string;
  scale: string;
  delay: number | null;
  timezones: ChannelTimezone[] | null;
  available: ChannelAvailableInterval[] | null;
  'user-agent': string;
}
