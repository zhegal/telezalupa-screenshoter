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
  streamCandidates?: ChannelStreamCandidate[];
}

export interface ChannelStreamCandidate {
  id: string;
  title: string;
  url: string;
  userAgent: string;
}
