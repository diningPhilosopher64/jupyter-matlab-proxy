function latexcode = convertMathMLToLaTeX(mathml)
% CONVERTMATHMLTOLATEX Converts MathML to LaTeX using EquationRenderer JS API.
%
% mathml - char array - MathML representation of symbolic expressions.

% Copyright 2023-2026 The MathWorks, Inc.

% Use persistent variables to avoid loading multiple webwindows.
persistent webwindow;
persistent idler;

if isempty(webwindow)
    % Use liveeditor index.html in older MATLAB versions
    if isMATLABReleaseOlderThan("R2026a")
        url = 'toolbox/matlab/codetools/liveeditor/index.html';
    else
        url = 'toolbox/matlab/editor/application/index.html';
    end
    
    % MATLAB versions R2020b and R2021a requires specifying the base url.
    % Not doing so results in the URL not being loaded with the error
    %"Not found. Request outside of context root".
    if isMATLABReleaseOlderThan("R2021b")
        url = strcat(getenv("MWI_BASE_URL"), '/', url);
    end
    webwindow = matlab.internal.cef.webwindow(connector.getUrl(url));
    idler = jupyter.Idler;
    webwindow.PageLoadFinishedCallback = @(a,b) pageLoadCallback(a,b,idler);
end

% This will block the thread until stop loading is called.
pageLoaded = idler.startIdling(10);

% If page is not loaded successfully, return empty.
if ~pageLoaded
    latexcode = '';
    return
end

% Use the EquationRenderer JS API to convert MathML to LaTeX.
webwindow.executeJS('eq = require("equationrenderercore/EquationRenderer")');
latexcode = jsondecode(webwindow.executeJS(sprintf('eq.convertMathMLToLaTeX(%s)', jsonencode(mathml))));

% Helper function to notify browser page load finished
function pageLoadCallback(webwindow,~,idler)
idler.stopIdling();
% Disable alert box which is preventing running JS after certain period of time.
webwindow.executeJS('window.alert = function(){}');
end

end
