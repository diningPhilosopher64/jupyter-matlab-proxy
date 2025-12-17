import { startMatlab, waitForMatlabToStart, convertToLiveCodeAndOpenMatlab, waitForUserToSignin } from './matlab';
import { NotebookPanel } from '@jupyterlab/notebook';
import { NotebookInfo } from '../utils/notebook';
import { getFileNameForConversion } from './file';
import { ICommunicationService } from '../plugins/matlabCommunication';
import { displayKernelBusyNotification, displayUserSigninNotification } from './notifications';

export function getOpenMatlabCommandId (): string {
    return 'matlab:open-matlab';
}

export function getOpenAsLiveCodeMLXInMatlabCommandId (): string {
    return 'matlab:open-as-live-code-mlx';
}

export function getOpenAsLiveCodeMInMatlabCommandId (): string {
    return 'matlab:open-as-live-code-m';
}

export function exportAsLiveCodeMlxMenuItemCommandId (): string {
    return 'matlab-menu-item:export-to-live-code-mlx';
}

export function exportAsLiveCodeMMenuItemCommandId (): string {
    return 'matlab-menu-item:export-to-live-code-m';
}

export function exportAsLiveCodeMlxPaletteItemCommandId (): string {
    return 'matlab-palette-item:export-to-live-code-mlx';
}

export function exportAsLiveCodeMPaletteItemCommandId (): string {
    return 'matlab-palette-item:export-to-live-code-m';
}

export function openMatlabButtonHandler (targetURL: string): globalThis.Window | null {
    const matlabTab = window.open(targetURL, '_blank');
    return matlabTab;
}

export async function openAsLiveCodeInMatlabButtonHandler (
    panel: NotebookPanel,
    commService: ICommunicationService,
    targetURL: string
): Promise<void> {
    const notebookInfo = new NotebookInfo();
    await notebookInfo.update(panel);

    if (notebookInfo.isBusy()) {
        displayKernelBusyNotification(notebookInfo);
    }
    const comm = await commService.getComm(panel.id);
    const finalLiveCodeFilePath = await getFileNameForConversion(
        panel,
        comm
    );

    if (!finalLiveCodeFilePath) {
        return; // User aborted the conversion, so return early..
    }

    const status = await startMatlab(panel, comm);
    if (!status.isMatlabLicensed) {
        const userSigninPromise = await displayUserSigninNotification();
        // No need to keep the window reference here as matlab window is
        // required to display to the liveCode file in the editor
        openMatlabButtonHandler(targetURL);

        await waitForUserToSignin(1000, comm, panel, userSigninPromise);
        await waitForMatlabToStart(1000, comm, panel);

        await convertToLiveCodeAndOpenMatlab(panel, comm, finalLiveCodeFilePath, false);
    } else {
        await waitForMatlabToStart(1000, comm, panel);
        await convertToLiveCodeAndOpenMatlab(panel, comm, finalLiveCodeFilePath, true);
    }
}
