// Copyright 2025 The MathWorks, Inc.

import { showDialog, Dialog, InputDialog } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ICommunicationChannel } from '../plugins/matlabCommunicationPlugin';
import { ActionFactory } from '../plugins/actions/actionFactory';
import { ActionTypes } from '../plugins/actions/actionTypes';
import { CheckFileExistsAction } from '../plugins/actions/checkFileExistsAction';

async function getNewFileName (
    currentFileName: string,
    mlxFileName: string
): Promise<string | null> {
    while (true) {
        const result = await showDialog({
            title: 'File already exists',
            body: `A file named "${mlxFileName}" already exists. Do you want to overwrite it or choose a new name?`,
            buttons: [
                Dialog.cancelButton(),
                Dialog.okButton({ label: 'Overwrite' }),
                Dialog.okButton({ label: 'New Name' })
            ]
        });

        console.log('\n user chose \n ', result);

        if (result.button.label === 'New Name') {
            const newNameResult = await InputDialog.getText({
                title: 'Enter a new name for the MLX file',
                label: 'New file name (without extension):',
                placeholder: 'Enter file name'
            });

            if (newNameResult.button.accept && newNameResult.value) {
                console.log(
                    'new file name is ',
                    newNameResult.value,
                    ' currentfilename is ',
                    currentFileName,
                    newNameResult.value === currentFileName
                );
                // User chose not to overwrite but provided the same name again...
                if (newNameResult.value === currentFileName) {
                    await showDialog({
                        title: 'Error',
                        body: 'The new filename is the same as the old one. Please choose a different name.',
                        buttons: [Dialog.okButton()]
                    });
                    continue;
                }

                return `${newNameResult.value}.mlx`;
            } else {
                // User cancelled, no need to proceed further
                return null;
            }
        } else if (result.button.label === 'Overwrite') {
            // User chose to overwrite the existing file
            const mlxFileNameWithoutExtension = PathExt.basename(
                currentFileName,
                PathExt.extname(currentFileName)
            );
            return `${mlxFileNameWithoutExtension}.mlx`;
        } else {
            return null; // User cancelled, no need to proceed further
        }
    }
}

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
    const mlxFileName = `${notebookNameWithoutExtension}.mlx`;
    let finalMlxFilePath = PathExt.join(currentDir, mlxFileName);

    const checkFileExistsAction = ActionFactory.createAction(
        ActionTypes.CHECK_FILE_EXISTS,
        true,
        notebook
    );
    await checkFileExistsAction.execute({ mlxFilePath: finalMlxFilePath }, comm);
    const fileAlreadyExists = CheckFileExistsAction.getFileExistsStatus();

    if (fileAlreadyExists) {
        const newFileName = await getNewFileName(notebookName, mlxFileName);
        console.log('New file name is ', newFileName);
        if (newFileName) {
            finalMlxFilePath = PathExt.join(currentDir, newFileName);
            return finalMlxFilePath;
        } else {
            return null; // User neither provided a new file name nor chose to overwrite, so return early
        }
    } else {
        return finalMlxFilePath;
    }
}
