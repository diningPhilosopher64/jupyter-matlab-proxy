import path from 'path';
import { NotebookPanel } from '@jupyterlab/notebook';
import { PageConfig } from '@jupyterlab/coreutils';

export class NotebookInfo {
    private _isNotebookOpen = false;
    private _notebookName : string | undefined = undefined;
    private _notebookLanguage : string | undefined = undefined;

    isMatlabNotebook (): boolean {
        return this._isNotebookOpen && this._notebookLanguage === 'matlab';
    }

    getCurrentFilePath (): string | undefined {
        if (this._notebookName) {
            return path.join(PageConfig.getOption('serverRoot'), this._notebookName);
        } else {
            return undefined;
        }
    }

    async update (panel: NotebookPanel | null) : Promise<void> {
        if (panel) {
            const context = panel.context;
            this._isNotebookOpen = context !== null;

            // Wait for session context to be ready
            if (!panel.sessionContext.isReady) {
                await panel.sessionContext.ready;
            }

            this._notebookName = context.path;
            const metadata = panel.content?.model?.metadata as any;
            if (metadata) {
                const kernelInfo = metadata.kernelspec as any;
                if (kernelInfo && kernelInfo.language) {
                    this._notebookLanguage = kernelInfo.language.toLowerCase();
                }
            }
        } else {
            console.log('No notebook opened');
            this._isNotebookOpen = false;
            this._notebookName = undefined;
            this._notebookLanguage = undefined;
        }
    }

    getCurrentFilename (): string | undefined {
        return this._notebookName;
    }
}
