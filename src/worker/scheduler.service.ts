import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;

  schedule(callback: () => void, delayMs: number): void {
    this.clear();
    this.timer = setTimeout(callback, delayMs);
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  hasScheduledRun(): boolean {
    return Boolean(this.timer);
  }
}
