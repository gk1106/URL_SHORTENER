import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../../shared/toast/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notifications = inject(ToastService);
  handleError(_error: unknown): void {
    this.notifications.show('An unexpected error occurred. Refresh the page if it continues.', 'error');
  }
}
