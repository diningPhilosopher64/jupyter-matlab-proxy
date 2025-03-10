import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import {
    INotebookTracker,
    NotebookPanel
} from '@jupyterlab/notebook';
import { Menu } from '@lumino/widgets';

import { CommunicationService, ICommunicationService } from './matlabCommunicationPlugin';
import { getFileNameForConversion } from '../utils/file';
import { convertToMLX, startMatlab } from '../utils/matlab';

let notebook: NotebookPanel | null = null;
let isMatlabNotebook = false;

export const matlabExportPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/MLXExportPlugin',
    autoStart: true,
    requires: [ICommandPalette, IMainMenu, INotebookTracker, CommunicationService],
    activate: async (
        app: JupyterFrontEnd,
        palette: ICommandPalette,
        mainMenu: IMainMenu,
        notebookTracker: INotebookTracker,
        commService: ICommunicationService
    ) => {
        console.log('Activated MATLAB Export Plugin');

        const { commands } = app;
        const fileMenu = mainMenu.fileMenu;

        const exportCommandPaletteItem = 'matlab-palette-item:export-to-MLX';
        const exportCommandMenuItem = 'matlab-menu-item:export-to-MLX';

        // Handle current notebook if it exists
        if (notebookTracker.currentWidget) {
            notebookTracker.currentWidget.context.ready.then(() => {
                notebook = notebookTracker.currentWidget;
                isMatlabNotebook = notebook?.context.model.metadata.kernelspec?.language === 'matlab';
            });
        }

        commands.addCommand(exportCommandPaletteItem, {
            label: 'Save and Export Notebook: MLX',
            execute: async () => {
                await exportHandler(commService);
            },
            isEnabled: () => isMatlabNotebook
        });

        palette.addItem({ command: exportCommandPaletteItem, category: 'File' });

        // Add command to the jupyterlab file menu
        let exportSubmenu: Menu | undefined;

        fileMenu.items.forEach(item => {
            if (item.type === 'submenu' && item.submenu) {
                const submenu = item.submenu;
                if (submenu.title.label === 'Save and Export Notebook As') {
                    exportSubmenu = submenu;
                }
            }
        });

        if (exportSubmenu) {
            commands.addCommand(exportCommandMenuItem, {
                label: 'MLX',
                execute: async () => {
                    await exportHandler(commService);
                },
                isEnabled: () => isMatlabNotebook
            });
            exportSubmenu.addItem({ command: exportCommandMenuItem });
        }

        // Set up listeners for current and future notebooks
        notebookTracker.widgetAdded.connect((_, notebookPanel) => {
            notebookPanel.context.ready.then(() => {
                updateState(notebookPanel);
            });
        });

        // Add state change listener to update whether commands should be enabled or disabled
        notebookTracker.currentChanged.connect(() => {
            updateState(notebookTracker.currentWidget);
            if (commands.hasCommand(exportCommandPaletteItem)) {
                commands.notifyCommandChanged(exportCommandPaletteItem);
                commands.notifyCommandChanged(exportCommandMenuItem);
            }
        });
    }
};

// Function to handle the export operation
async function exportHandler (commService: ICommunicationService): Promise<void> {
    console.log('Exporting to MLX', notebook);
    if (!notebook) {
        return;
    }
    const comm = commService.getComm(notebook.id);
    const finalMlxFilePath = await getFileNameForConversion(notebook, comm);
    if (!finalMlxFilePath) {
        return; // User aborted the conversion, so return early..
    }
    await startMatlab(notebook, comm);
    await convertToMLX(notebook, comm, finalMlxFilePath);
}

function updateState (notebookPanel: NotebookPanel | null) {
    notebook = notebookPanel;
    isMatlabNotebook = notebook?.context.model.metadata.kernelspec?.language === 'matlab';
}
