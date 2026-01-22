// Copyright 2025 The MathWorks, Inc.

import { PathExt } from '@jupyterlab/coreutils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ICommunicationChannel } from '../plugins/matlabCommunication';
import { ActionFactory } from '../plugins/actions/actionFactory';
import { ActionTypes } from '../plugins/actions/actionTypes';
import { CheckFileExistsAction } from '../plugins/actions/checkFileExistsAction';
import { getNewFileNameDialog } from './dialogs';

export async function getFileNameForConversion (
    notebook: NotebookPanel,
    comm: ICommunicationChannel
): Promise<string | null> {
    const notebookName = notebook.context.path; // An ipynb file is guarranteed to be here as we are in a Notebook

    const currentDir = PathExt.dirname(notebookName);
    const notebookNameWithoutExtension = PathExt.basename(
        notebookName,
        PathExt.extname(notebookName)
    );
    const liveCodeFilePath = `${notebookNameWithoutExtension}.mlx`;
    let finalLiveCodeFilePath = PathExt.join(currentDir, liveCodeFilePath);

    const checkFileExistsAction = ActionFactory.createAction(
        ActionTypes.CHECK_FILE_EXISTS,
        true,
        notebook
    );
    await checkFileExistsAction.execute({ liveCodeFilePath: finalLiveCodeFilePath }, comm);
    const fileAlreadyExists = CheckFileExistsAction.getFileExistsStatus();

    if (fileAlreadyExists) {
        const newFileName = await getNewFileNameDialog(notebookName, liveCodeFilePath);
        console.debug('New file name chosen by the user is ', newFileName);
        if (newFileName) {
            finalLiveCodeFilePath = PathExt.join(currentDir, newFileName);
            return finalLiveCodeFilePath;
        } else {
            return null; // User neither provided a new file name nor chose to overwrite, so return early
        }
    } else {
        return finalLiveCodeFilePath;
    }
}
