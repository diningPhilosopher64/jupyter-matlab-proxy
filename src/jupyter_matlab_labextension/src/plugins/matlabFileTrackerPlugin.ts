// Copyright 2025 The MathWorks, Inc.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { PageConfig } from '@jupyterlab/coreutils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Token } from '@lumino/coreutils';

import path from 'path';

let currentFileName : string | undefined;
let notebookLanguage : string | undefined;
let currentNotebook: NotebookPanel | null;
let isNotebookOpen = false;

// Define a unique token for the FileTracker plugin
export const FileTrackerService = new Token<any>('@mathworks/MatlabFileTrackerPlugin');

// Global plugin. Initialized once and used by all notebooks.
export const matlabFileTrackerPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/FileTrackerPlugin',
    autoStart: true,
    requires: [INotebookTracker, IFileBrowserFactory],
    provides: FileTrackerService,
    activate: async (
        app: JupyterFrontEnd,
        notebookTracker: INotebookTracker,
        factory: IFileBrowserFactory
    ) => {
        // If jupyterlab interface loads for the first time with a notebook already opened
        // update currentFileName to notebooks' name.
        currentNotebook = notebookTracker.currentWidget;

        if (currentNotebook) {
            await updateNotebookInfo(currentNotebook);
        } else {
            currentFileName = undefined;
            notebookLanguage = undefined;
            isNotebookOpen = false;
        }
        console.log(currentFileName ? `Current file name is ${currentFileName}` : 'No file opened');

        // Add state change listener
        notebookTracker.currentChanged.connect(async (_, currentNotebook) => {
            if (currentNotebook) {
                await updateNotebookInfo(currentNotebook);
            } else {
                currentFileName = undefined;
                notebookLanguage = undefined;
                isNotebookOpen = false;
            }
            console.log(currentFileName ? `Current file name is ${currentFileName}` : 'No file opened');
        });
        console.log('MATLAB FileTracker Plugin activated!', PageConfig.getOption('serverRoot'));
        const currentPath = factory.tracker.currentWidget?.model.path;

        console.log('Current direcotry path is ', currentPath, typeof (currentPath), currentPath?.length);
    }
};

export function isMatlabNotebook (): boolean {
    return isNotebookOpen && notebookLanguage === 'matlab';
}

export function getCurrentFileName (): string | undefined {
    return currentFileName;
}

export function getCurrentFilePath (): string | undefined {
    if (currentFileName) {
        return path.join(PageConfig.getOption('serverRoot'), currentFileName);
    } else {
        return undefined;
    }
}

export function getCurrentNotebook (): NotebookPanel | null {
    return currentNotebook;
}

export async function updateNotebookInfo (panel: NotebookPanel): Promise<void> {
    await panel.sessionContext.ready;
    currentFileName = panel.context.path;
    const metadata = panel.content?.model?.metadata as any;
    if (metadata) {
        const kernelInfo = metadata.kernelspec as any;
        if (kernelInfo && kernelInfo.language) {
            notebookLanguage = kernelInfo.language.toLowerCase();
        }
    }

    isNotebookOpen = panel.context !== null && panel.context.path.endsWith('.ipynb');
}
