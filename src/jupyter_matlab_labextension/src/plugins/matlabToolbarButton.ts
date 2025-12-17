// Copyright 2023-2025 The MathWorks, Inc.

// Registers the button which allows access to MATLAB in a browser, which will
// appear in the notebook toolbar.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ToolbarButton } from '@jupyterlab/apputils';
// import { PageConfig } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { DisposableDelegate } from '@lumino/disposable';
import { Menu } from '@lumino/widgets';

import { IMatlabCommunication, ICommunicationService } from './matlabCommunication';
import { NotebookInfo } from '../utils/notebook';
import { getOpenAsLiveCodeMLXInMatlabCommandId, getOpenMatlabCommandId, openAsLiveCodeInMatlabButtonHandler, openMatlabButtonHandler } from '../utils/commands';

import { matlabIcon } from '../icons';

// function createMATLABToolbarButton (targetUrl: string): ToolbarButton {
//     return new ToolbarButton({
//         className: 'openMATLABButton matlab-toolbar-button-spaced',
//         icon: matlabIcon,
//         label: 'Open MATLAB',
//         tooltip: 'Open MATLAB',
//         onClick: (): void => {
//             window.open(targetUrl, '_blank');
//         }
//     });
// }

/** Wait until the kernel has loaded, then check if it is a MATLAB kernel. */
// export const insertButton = async (panel: NotebookPanel): Promise<DisposableDelegate> => {
//     try {
//         await panel.sessionContext.ready;
//         let targetUrl = '';
//         let matlabToolbarButton: ToolbarButton | null = null;

//         // Function to update the target URL based on kernel ID
//         const updateTargetUrl = (): void => {
//             // Check if the kernel is a MATLAB Kernel
//             if (panel.sessionContext.kernelDisplayName === 'MATLAB Kernel') {
//                 let kernelId = '';

//                 // Check that session and kernel exist and then retrieve kernel ID
//                 if (panel.sessionContext.session && panel.sessionContext.session.kernel) {
//                     kernelId = panel.sessionContext.session.kernel.id;
//                 }

//                 if (kernelId !== '') {
//                     targetUrl = PageConfig.getBaseUrl() + 'matlab/' + kernelId + '/';

//                     // Create the button if it doesn't exist yet
//                     if (!matlabToolbarButton) {
//                         matlabToolbarButton = createMATLABToolbarButton(targetUrl);
//                         panel.toolbar.insertItem(10, 'matlabToolbarButton', matlabToolbarButton);
//                     } else {
//                         // Update the button's onClick handler
//                         matlabToolbarButton.onClick = () => {
//                             window.open(targetUrl, '_blank');
//                         };
//                     }
//                 }
//             }
//         };

//         // Create Open MATLAB toolbar button
//         updateTargetUrl();

//         // Listen for kernel changes
//         panel.sessionContext.kernelChanged.connect(() => {
//             updateTargetUrl();
//         });

//         // Create a disposable that will clean up the listener
//         return new DisposableDelegate(() => {
//             if (matlabToolbarButton) {
//                 matlabToolbarButton.dispose();
//             }
//             panel.sessionContext.kernelChanged.disconnect(() => {
//                 updateTargetUrl();
//             });
//         });
//     } catch (error) {
//         console.error('Failed to insert MATLAB toolbar button: ', error);
//         return new DisposableDelegate(() => {});
//     }
// };

export class MatlabToolbarButtonExtension
implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    private readonly commService: ICommunicationService;
    private readonly app: JupyterFrontEnd;
    // Keep track of whether commands have been registered
    private static commandsRegistered = false;

    constructor (commService: ICommunicationService, app: JupyterFrontEnd) {
        this.commService = commService;
        this.app = app;
    }

    createNew (
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>
    ): DisposableDelegate {
        panel.sessionContext.ready
            .then(async () => {
                const kernel = panel.sessionContext.session?.kernel;

                // If kernel is available, create channel and set up listeners.
                if (!kernel) {
                    console.error("Kernel not ready! Can't create toolbar button");
                    return new DisposableDelegate(() => {});
                }

                const notebookInfo = new NotebookInfo();
                await notebookInfo.update(panel);

                if (!notebookInfo.isMatlabNotebook()) {
                    console.debug('Not a MATLAB notebook, skipping button setup');
                    return new DisposableDelegate(() => {});
                }

                if (!MatlabToolbarButtonExtension.commandsRegistered) {
                    const targetURL = notebookInfo.getTargetURL()!;
                    this.app.commands.addCommand(getOpenMatlabCommandId(), {
                        label: 'Open MATLAB',
                        icon: matlabIcon,
                        execute: () => openMatlabButtonHandler(targetURL)
                    });

                    this.app.commands.addCommand(getOpenAsLiveCodeMLXInMatlabCommandId(), {
                        label: 'Open as Live Code in MATLAB',
                        icon: matlabIcon,
                        execute: async () => openAsLiveCodeInMatlabButtonHandler(panel, this.commService, targetURL)
                    });

                    MatlabToolbarButtonExtension.commandsRegistered = true;
                }

                // Create the menu for this notebook toolbar button
                const menu = new Menu({ commands: this.app.commands });
                menu.addItem({ command: getOpenMatlabCommandId() });
                menu.addItem({ command: getOpenAsLiveCodeMLXInMatlabCommandId() });

                /**  Create the toolbar button to show the drop down menu created above */
                const matlabToolbarButton = new ToolbarButton({
                    className: 'openMATLABButton matlab-toolbar-button-spaced',
                    icon: matlabIcon,
                    label: 'Open MATLAB ▼',
                    tooltip: 'Open MATLAB',
                    onClick: (): void => {
                        // On button click, open the menu and position it below the button
                        const buttonElement = matlabToolbarButton.node;
                        const rect = buttonElement.getBoundingClientRect();
                        menu.open(rect.left, rect.bottom);
                    }
                });
                panel.toolbar.insertItem(10, 'openMatlabButton', matlabToolbarButton);


                // Listen for kernel changes
                panel.sessionContext.kernelChanged.connect(async () => {
                    await notebookInfo.update(panel);
                });

                return new DisposableDelegate(() => {
                    matlabToolbarButton.dispose();
                    menu.dispose();
                });
            }).catch((error) => {
                console.error('Error initializing MATLAB toolbar button:', error);
                return new DisposableDelegate(() => {});
            });

        // Return a dummy disposable immediately
        return new DisposableDelegate(() => {});
    }
}

export const matlabToolbarButtonPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/matlabToolbarButtonPlugin',
    autoStart: true,
    requires: [IMatlabCommunication],
    activate: (app: JupyterFrontEnd, commService: ICommunicationService) => {
        const matlabToolbarButton = new MatlabToolbarButtonExtension(commService, app);
        app.docRegistry.addWidgetExtension('Notebook', matlabToolbarButton);
    }
};
