# Copyright 2025 The MathWorks, Inc.

import pytest
from pathlib import Path
from jupyter_matlab_kernel.comms.labextension.actions import ConvertAction
from jupyter_matlab_kernel.comms.labextension.actions.types import ActionTypes


@pytest.fixture
def mock_kernel(mocker):
    """Create a mock kernel for testing."""
    kernel = mocker.MagicMock()
    kernel.log = mocker.MagicMock()
    kernel.mwi_comm_helper = mocker.MagicMock()
    return kernel


@pytest.fixture
def mock_comm(mocker):
    """Create a mock comm object for testing."""
    return mocker.MagicMock()


@pytest.fixture
def convert_action(mock_kernel):
    """Create a ConvertAction instance for testing."""
    return ConvertAction(mock_kernel)


def test_init_sets_kernel_and_log(mock_kernel):
    """Test that initialization sets kernel and log attributes."""
    action = ConvertAction(mock_kernel)
    assert action.kernel is mock_kernel
    assert action.log is mock_kernel.log


def test_get_code_returns_ipynb2mlx_command(convert_action):
    """Test that get_code returns correct MATLAB command."""
    result = convert_action.get_code("/path/to/file.ipynb", "/path/to/file.mlx")
    assert result == 'ipynb2mlx("/path/to/file.ipynb","/path/to/file.mlx")'


def test_get_code_mlx_to_m_conversion(convert_action):
    """Test that _get_code_mlx_to_m_conversion returns correct MATLAB command."""
    result = convert_action._get_code_mlx_to_m_conversion(
        "/path/to/file.mlx", "/path/to/file.m"
    )
    assert "matlab.desktop.editor.openDocument" in result
    assert "/path/to/file.mlx" in result
    assert "/path/to/file.m" in result
    assert "saveAs" in result


@pytest.mark.parametrize(
    "version,expected",
    [
        pytest.param("R2025a", True, id="2025a"),
        pytest.param("R2025b", True, id="2025b"),
        pytest.param("R2026a", True, id="2026a"),
        pytest.param("R2024b", False, id="2024b"),
        pytest.param("R2024a", False, id="2024a"),
        pytest.param("R2023b", False, id="2023b"),
        pytest.param(None, False, id="none"),
        pytest.param("", False, id="empty"),
        pytest.param("invalid", False, id="invalid"),
    ],
)
def test_is_matlab_version_25a_or_later(convert_action, version, expected):
    """Test MATLAB version checking for 25a or later."""
    assert convert_action._is_matlab_version_25a_or_later(version) == expected


def test_validate_data(convert_action):
    """Test validate_data raises for invalid data and succeeds for valid data."""
    with pytest.raises(ValueError) as exc_info:
        convert_action.validate_data({})
    assert "ipynbFilePath" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        convert_action.validate_data({"ipynbFilePath": "/path/to/file.ipynb"})
    assert "liveCodeFilePath" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        convert_action.validate_data({"liveCodeFilePath": "/path/to/file.mlx"})
    assert "ipynbFilePath" in str(exc_info.value)

    convert_action.validate_data(
        {
            "ipynbFilePath": "/path/to/file.ipynb",
            "liveCodeFilePath": "/path/to/file.mlx",
        }
    )


@pytest.mark.asyncio
async def test_execute_sends_error_on_validation_failure(convert_action, mock_comm):
    """Test that execute sends error response when validation fails."""
    await convert_action.execute(mock_comm, {})

    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CONVERT.value
    assert call_args["liveCodeFilePath"] is None
    assert call_args["error"] is not None
    convert_action.log.error.assert_called_once()


@pytest.mark.asyncio
async def test_execute_converts_successfully_pre_25a(convert_action, mock_comm, mocker):
    """Test successful conversion for MATLAB versions before 25a."""
    mock_status = mocker.MagicMock()
    mock_status.matlab_version = "R2024b"
    convert_action.kernel.mwi_comm_helper.fetch_matlab_proxy_status = mocker.AsyncMock(
        return_value=mock_status
    )
    convert_action.kernel.mwi_comm_helper.send_eval_request_to_matlab = (
        mocker.AsyncMock(return_value={"isError": False, "responseStr": ""})
    )

    data = {"ipynbFilePath": "~/notebook.ipynb", "liveCodeFilePath": "notebook.mlx"}

    await convert_action.execute(mock_comm, data)

    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CONVERT.value
    assert call_args["error"] is None
    assert "notebook.mlx" in call_args["liveCodeFilePath"]


@pytest.mark.asyncio
async def test_execute_converts_successfully_25a_or_later(
    convert_action, mock_comm, mocker
):
    """Test successful conversion for MATLAB 25a or later with mlx to m conversion."""
    mock_status = mocker.MagicMock()
    mock_status.matlab_version = "R2025a"
    convert_action.kernel.mwi_comm_helper.fetch_matlab_proxy_status = mocker.AsyncMock(
        return_value=mock_status
    )
    convert_action.kernel.mwi_comm_helper.send_eval_request_to_matlab = (
        mocker.AsyncMock(return_value={"isError": False, "responseStr": ""})
    )

    data = {"ipynbFilePath": "~/notebook.ipynb", "liveCodeFilePath": "notebook.mlx"}

    await convert_action.execute(mock_comm, data)

    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CONVERT.value
    assert call_args["error"] is None
    assert call_args["liveCodeFilePath"].endswith(".m")


@pytest.mark.asyncio
async def test_execute_sends_error_on_eval_failure(convert_action, mock_comm, mocker):
    """Test that execute sends error when MATLAB eval fails."""
    convert_action.kernel.mwi_comm_helper.send_eval_request_to_matlab = (
        mocker.AsyncMock(
            side_effect=[
                {"isError": False, "responseStr": ""},  # clc response
                {
                    "isError": True,
                    "responseStr": "Conversion failed",
                    "response_str": "Conversion failed",
                },
            ]
        )
    )

    data = {"ipynbFilePath": "~/notebook.ipynb", "liveCodeFilePath": "notebook.mlx"}

    await convert_action.execute(mock_comm, data)

    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CONVERT.value
    assert call_args["liveCodeFilePath"] is None
    assert call_args["error"] is not None


@pytest.mark.asyncio
async def test_execute_sends_error_on_exception(convert_action, mock_comm, mocker):
    """Test that execute sends error response when exception occurs."""
    error_message = "Connection failed"
    convert_action.kernel.mwi_comm_helper.send_eval_request_to_matlab = (
        mocker.AsyncMock(side_effect=Exception(error_message))
    )

    data = {"ipynbFilePath": "~/notebook.ipynb", "liveCodeFilePath": "notebook.mlx"}

    await convert_action.execute(mock_comm, data)

    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CONVERT.value
    assert call_args["liveCodeFilePath"] is None
    assert call_args["error"] == error_message
    convert_action.log.error.assert_called()
