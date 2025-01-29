% Need to dynamically fetch this url from jupyter somehow...
% Should not contain /matlab but will contain jupyter's base url if any.
url = "http://localhost:8888/lab/tree";

activeDocument = matlab.desktop.editor.getActive();
[dirPath, fileName, fileExtension] = fileparts(activeDocument.Filename);
isMLX = strcmpi(fileExtension, '.mlx');
ipynbFileName = fileName + ".ipynb";

if ~isMLX
    disp('Not mlx');
    % TODO: Throw error / warning ?
end

if exist(fullfile(dirPath, ipynbFileName), 'file') == 2
    % TODO: Show prompt to overwrite or get the new filename
    % ipynbFilename = 
end

ipynbFilePath = fullfile(dirPath, ipynbFileName);

mlx2ipynb(ipynbFilePath)

%TODO: Does this always work ? What if there's a nested ipynb file? 
web(url + "/" + ipynbFileName, '-browser')