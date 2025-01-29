// Copyright 2025 The MathWorks, Inc.

import { showDialog, Dialog, InputDialog } from '@jupyterlab/apputils';

export async function getNewFileName (currentFileName: string): Promise<string | null> {
    while (true) {
        const result = await showDialog({
            title: 'File already exists',
            body: `A file named "${currentFileName}" already exists. Do you want to overwrite it or choose a new name?`,
            buttons: [
                Dialog.cancelButton(),
                Dialog.okButton({ label: 'Overwrite' }),
                Dialog.okButton({ label: 'New Name' })
            ]
        });

        if (result.button.label === 'New Name') {
            const newNameResult = await InputDialog.getText({
                title: 'Enter a new name for the MLX file',
                label: 'New file name (without extension):',
                placeholder: 'Enter file name'
            });

            if (newNameResult.button.accept && newNameResult.value) {
                console.log('new file name is ', newNameResult.value, ' currentfilename is ', currentFileName, newNameResult.value === currentFileName);
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
            return currentFileName; // User chose to overwrite the existing file
        } else {
            return null; // User cancelled, no need to proceed further
        }
    }
}
