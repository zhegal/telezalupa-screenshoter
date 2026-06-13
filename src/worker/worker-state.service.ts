import { Injectable } from '@nestjs/common';

export type WorkerStatus = 'stopped' | 'running';

@Injectable()
export class WorkerStateService {
  private status: WorkerStatus = 'stopped';
  private isCycleRunning = false;

  getStatus(): WorkerStatus {
    return this.status;
  }

  setStatus(status: WorkerStatus): void {
    this.status = status;
  }

  getCycleRunning(): boolean {
    return this.isCycleRunning;
  }

  setCycleRunning(isCycleRunning: boolean): void {
    this.isCycleRunning = isCycleRunning;
  }
}
