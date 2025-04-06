%-------------------------------------------------------------------
%
% mlx2ipynb should be used when working in Juypter.
%
% Reason: mlx2ipynb is simpler to use than convertMLX2IPYNB.
%
% Note: convertMLX2IPYNB(mlxFilename, ipynbFilename, ...)
%       does not work in Jupyter.
%       Only convertMLX2IPYNB("active", ipynbFilename, ...)
%       works in Jupyter.
% 
% mlx2ipynb() calls convertMLX2IPYNB("active", ipynbFilename)
%    where ipynbFilename is created using the name and path of the 
%    active document in the (Live) Editor.
%
% mlx2ipynb(ipynbFilename) calls convertMLX2IPYNB("active", ipynbFilename).
%
% mlx2ipynb(name, value, ...) calls 
%    convertMLX2IPYNB("active", ipynbFilename, name, value, ...).
%    where ipynbFilename is created using the name and path of the 
%    active document in the (Live) Editor.
% 
% mlx2ipynb(ipynbFilename, name, value, ...) calls 
%    convertMLX2IPYNB("active", ipynbFilename, name, value, ...).
%
%
% Examples:
%
% >> mlx2ipynb
%
% >> mlx2ipynb("test.ipynb")
%
% >> mlx2ipynb("test.ipynb", "IncludeOutputs", false)
%
% >> mlx2ipynb("EmbedImages", false)
%
% Copyright 2023 The MathWorks, Inc.
%-------------------------------------------------------------------

function ipynbFilename = mlx2ipynb(varargin)
if nargin == 0
    ipynbFilename = ipynbFilenameFromActiveDocument();
    options = {};
elseif mod(nargin, 2) == 0 % nargin > 0 and nargin is even
    % All input arguments must be name-value pairs
    ipynbFilename = ipynbFilenameFromActiveDocument();
    options = varargin;
else % nargin > 0 and nargin is odd
    filename = varargin{1};
    [~, ~, ext] = fileparts(filename);
    if ext ~= ".ipynb"
        error("First argument must be a filename with extension .ipynb.");
    end
    ipynbFilename = filename;
    options = varargin(2:end);
end
ipynbFilename = convertMLX2IPYNB("active", ipynbFilename, options{:});
end

function ipynbFilename = ipynbFilenameFromActiveDocument
doc = matlab.desktop.editor.getActive;
if isempty(doc)
    error("No live script opened in the editor.");
end
[path, ipynbFilename] = fileparts(string(doc.Filename));
ipynbFilename = fullfile(path, ipynbFilename + ".ipynb");
end