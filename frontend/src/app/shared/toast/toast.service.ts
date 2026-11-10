import { Injectable, signal } from '@angular/core';

interface Toast { readonly id: number; readonly message: string; readonly kind: 'success' | 'error'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<readonly Toast[]>([]);
  private nextId = 0;
  show(message: string, kind: Toast['kind'] = 'success'): void {
    const id = ++this.nextId;
    this.messages.update(current => [...current.slice(-2), { id, message, kind }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 9000 : 4500);
  }
  dismiss(id: number): void {
    this.messages.update(current => current.filter(message => message.id !== id));
  }
}
