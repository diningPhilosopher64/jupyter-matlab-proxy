import { NotebookPanel } from '@jupyterlab/notebook';
import { ICommunicationService } from '../plugins/matlabCommunication';
import { displayKernelBusyNotification, displayUserSigninNotification } from './notifications';
import { openMatlabButtonHandler } from './commands';
import { getFileNameForConversion } from '../utils/file';
import { convertToLiveCode, startMatlab, waitForMatlabToStart, waitForUserToSignin } from '../utils/matlab';
import { NotebookInfo } from './notebook';
import { Notification } from '@jupyterlab/apputils';

export async function exportHandler (
    commService: ICommunicationService,
    panel: NotebookPanel | null,
    targetURL: string
): Promise<void> {
    console.debug('Exporting to live code', panel);
    if (!panel) {
        console.error('No active notebook to export');
        return;
    }
    const notebookInfo = new NotebookInfo();
    await notebookInfo.update(panel);

    if (notebookInfo.isBusy()) {
        displayKernelBusyNotification(notebookInfo);
    }
    const comm = await commService.getComm(panel.id);

    const finalMlxFilePath = await getFileNameForConversion(
        panel,
        comm
    );
    if (!finalMlxFilePath) {
        return; // User aborted the conversion, so return early..
    }

    const status = await startMatlab(panel, comm);

    if (!status.isMatlabLicensed) {
        const userSigninPromise = await displayUserSigninNotification();

        const window = openMatlabButtonHandler(targetURL);
        await waitForUserToSignin(1000, comm, panel, userSigninPromise);

        // As this is export workflow, it is not required to open the matlab editor.
        // So, close the window and proceed starting matlab and conversion to mlx
        if (window && !window.closed) {
            window.close();
        }
    }

    await waitForMatlabToStart(1000, comm, panel);
    await convertToLiveCode(panel, comm, finalMlxFilePath);
    Notification.info(`File ${finalMlxFilePath} ready`, { autoClose: 2000 });
}
