// Copyright 2025 The MathWorks, Inc.

import path from 'path';
import { NotebookPanel } from '@jupyterlab/notebook';
import { PageConfig } from '@jupyterlab/coreutils';

export class NotebookInfo {
    private _notebookName: string | undefined = undefined;
    private _isMatlabNotebook: boolean = false;
    private _isBusy: boolean = false;
    private _panel: NotebookPanel | null = null;

    isMatlabNotebook (): boolean {
        return this._isMatlabNotebook;
    }

    isBusy (): boolean {
        return this._isMatlabNotebook ? this._isBusy : false;
    }

    getCurrentFilePath (): string | undefined {
        if (this._notebookName) {
            return path.join(PageConfig.getOption('serverRoot'), this._notebookName);
        } else {
            return undefined;
        }
    }

    async waitForIdleStatus (): Promise<void> {
        if (!this._panel) {
            throw Error('No notebook panel provided');
        } else {
            return new Promise((resolve) => {
                if (this._panel!.sessionContext.session?.kernel?.status === 'idle') {
                    resolve();
                } else {
                    const onStatusChanged = (connection: any, status: string) => {
                        if (status === 'idle') {
                            // Disconnect listener from statusChanged signal so that it doesn't get called again.
                            connection.statusChanged.disconnect(onStatusChanged);
                            resolve();
                        }
                    };
          this._panel!.sessionContext.session?.kernel?.statusChanged.connect(
              onStatusChanged
          );
                }
            });
        }
    }

    async update (panel: NotebookPanel | null): Promise<void> {
        if (panel) {
            this._panel = panel;
            this._isMatlabNotebook =
        panel.context.model.metadata.kernelspec?.language === 'matlab';
            const context = panel.context;
            // Wait for session context to be ready
            if (!panel.sessionContext.isReady) {
                await panel.sessionContext.ready;
            }

            this._isBusy = panel.sessionContext.session?.kernel?.status === 'busy';
            this._notebookName = context.path;
        } else {
            this._notebookName = undefined;
            this._isMatlabNotebook = false;
            this._isBusy = false;
            this._panel = null;
        }
    }

    interrupt (): void {
        if (this._panel) {
            this._panel.sessionContext.session?.kernel?.interrupt();
            console.log('Kernel interupted');
        }
    }

    getCurrentFilename (): string | undefined {
        return this._notebookName;
    }
}
