// // Copyright 2025 The MathWorks, Inc.

// import {
//     JupyterFrontEnd,
//     JupyterFrontEndPlugin
// } from '@jupyterlab/application';

// import { ICommandPalette } from '@jupyterlab/apputils';

// import { IMainMenu } from '@jupyterlab/mainmenu';
// import { INotebookTracker } from '@jupyterlab/notebook';
// import { Menu } from '@lumino/widgets';

// import { PathExt } from '@jupyterlab/coreutils';

// import { CommunicationService } from './matlabCommunicationPlugin';
// import { ActionFactory } from './actions/actionFactory';
// import { ActionTypes } from './actions/actionTypes';
// import { CheckFileExistsAction } from './actions/checkFileExistsAction';
// import { getNewFileName } from '../utils/file';
// import { MatlabStatusAction } from './actions/matlabStatusAction';
// import { getMatlabUrl, handleMatlabLicensing, waitForMatlabToStart } from '../utils/matlab';
// import { NotebookInfo } from '../utils/notebook';

// export const matlabExportPlugin: JupyterFrontEndPlugin<void> = {
//     id: '@mathworks/MLXExportPlugin',
//     autoStart: true,
//     requires: [ICommandPalette, IMainMenu, INotebookTracker, CommunicationService],
//     activate: async (
//         app: JupyterFrontEnd,
//         palette: ICommandPalette,
//         mainMenu: IMainMenu,
//         notebookTracker: INotebookTracker
//     ) => {
//         const notebookInfo = new NotebookInfo();
//         console.log('Notebook check ', notebookTracker.currentWidget);
//         await notebookInfo.update(notebookTracker.currentWidget);
//         console.log('\n \n asdf ', notebookInfo.isMatlabNotebook());
//         const { commands } = app;
//         const fileMenu = mainMenu.fileMenu;

//         const exportCommandPaletteItem = 'matlab-palette-item:export-to-MLX';
//         const exportCommandMenuItem = 'matlab-menu-item:export-to-MLX';

//         // Add command to the jupyterlab palette
//         commands.addCommand(exportCommandPaletteItem, {
//             label: 'Save and Export Notebook: MLX',
//             execute: async () => {
//                 await notebookInfo.update(notebookTracker.currentWidget);
//                 await exportHandler(notebookInfo.getCurrentFilePath());
//             },
//             isEnabled: () => notebookInfo.isMatlabNotebook()
//         });

//         palette.addItem({ command: exportCommandPaletteItem, category: 'File' });

//         // Add command to the jupyterlab file menu
//         let exportSubmenu: Menu | undefined;

//         fileMenu.items.forEach(item => {
//             if (item.type === 'submenu' && item.submenu) {
//                 const submenu = item.submenu;
//                 if (submenu.title.label === 'Save and Export Notebook As') {
//                     exportSubmenu = submenu;
//                 }
//             }
//         });

//         if (exportSubmenu) {
//             commands.addCommand(exportCommandMenuItem, {
//                 label: 'MLX',
//                 execute: async () => {
//                     console.log('notebook check .....', notebookTracker.currentWidget);
//                     await notebookInfo.update(notebookTracker.currentWidget);
//                     await exportHandler(notebookInfo.getCurrentFilePath());
//                 },
//                 isEnabled: () => notebookInfo.isMatlabNotebook()
//             });
//             exportSubmenu.addItem({ command: exportCommandMenuItem });
//         }

//         // Add state change listener
//         notebookTracker.currentChanged.connect(() => {
//             // Will disable commands for export if there's no active IPYNB file open.
//             commands.notifyCommandChanged(exportCommandPaletteItem);
//             if (exportSubmenu) {
//                 commands.notifyCommandChanged(exportCommandMenuItem);
//             }
//         });
//         console.log('MATLAB Export Plugin activated!');
//     }
// };

// // TODO: Need to ensure that the IPYNB file has matlab language in it and not python or some other language
// async function exportHandler (filePath: string | undefined) : Promise<void> {
//     console.log('Exporting to MLX');
//     if (filePath) {
//         const currentDir = PathExt.dirname(filePath);
//         const currentFileNameWithoutExtension = PathExt.basename(filePath, PathExt.extname(filePath));
//         const mlxFileName = `${currentFileNameWithoutExtension}.mlx`;
//         let finalMlxFilePath = PathExt.join(currentDir, mlxFileName);

//         const checkFileExistsAction = ActionFactory.createAction(ActionTypes.CHECK_FILE_EXISTS, true);
//         await checkFileExistsAction.execute({ mlxFilePath: finalMlxFilePath });

//         const fileAlreadyExists = CheckFileExistsAction.getFileExistsStatus();

//         if (fileAlreadyExists) {
//             const newFileName = await getNewFileName(currentFileNameWithoutExtension);
//             if (newFileName) {
//                 finalMlxFilePath = PathExt.join(currentDir, newFileName);
//             } else {
//                 return; // User neither provided a new file name nor chose to overwrite, so return early
//             }
//         }

//         // Send StartMatlabProxy action to kernel. This would be a no-op if matlab-proxy is already up
//         const startMatlabProxyAction = ActionFactory.createAction(ActionTypes.START_MATLAB_PROXY, true);
//         await startMatlabProxyAction.execute(null);

//         // Get status of matlab-proxy
//         const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true);
//         await matlabStatusAction.execute(null);

//         let status = MatlabStatusAction.getStatus();

//         if (!status.isLicensed) {
//             await handleMatlabLicensing(getMatlabUrl());

//             // After sign in, re-fetch matlab status for the updated status
//             await matlabStatusAction.execute(null);
//             status = MatlabStatusAction.getStatus();
//         }

//         if (status.status === 'starting') {
//             await waitForMatlabToStart(1000);
//         }

//         const convertAction = ActionFactory.createAction(ActionTypes.CONVERT, true);
//         await convertAction.execute({
//             action: ActionTypes.CONVERT,
//             ipynbFilePath: filePath,
//             mlxFilePath: finalMlxFilePath
//         });
//     }
// }
