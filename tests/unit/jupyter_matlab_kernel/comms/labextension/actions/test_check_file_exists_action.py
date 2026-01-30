# Copyright 2025 The MathWorks, Inc.

import pytest
from pathlib import Path
from jupyter_matlab_kernel.comms.labextension.actions import (
    CheckFileExistsAction,
)
from jupyter_matlab_kernel.comms.labextension.actions.types import ActionTypes


@pytest.fixture
def mock_kernel(mocker):
    """Create a mock kernel for testing."""
    kernel = mocker.MagicMock()
    kernel.log = mocker.MagicMock()
    return kernel


@pytest.fixture
def mock_comm(mocker):
    """Create a mock comm object for testing."""
    comm = mocker.MagicMock()
    return comm


@pytest.fixture
def check_file_exists_action(mock_kernel):
    """Create a CheckFileExistsAction instance for testing."""
    return CheckFileExistsAction(mock_kernel)


def test_init_sets_kernel_and_log(mock_kernel):
    """Test that initialization sets kernel and log attributes."""
    # Act
    action = CheckFileExistsAction(mock_kernel)

    # Assert
    assert action.kernel is mock_kernel
    assert action.log is mock_kernel.log


def test_get_code_returns_none(check_file_exists_action):
    """Test that get_code returns None."""
    # Act
    result = check_file_exists_action.get_code()

    # Assert
    assert result is None


def test_validate_data(check_file_exists_action):
    """Test validate_data raises for invalid data and succeeds for valid data."""
    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        check_file_exists_action.validate_data({})
    assert "'liveCodeFilePath' is required" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        check_file_exists_action.validate_data({"other_key": "value"})
    assert "'liveCodeFilePath' is required" in str(exc_info.value)

    check_file_exists_action.validate_data({"liveCodeFilePath": "/path/to/file"})


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "data",
    [
        pytest.param({}, id="missing_path"),
        pytest.param({"liveCodeFilePath": ""}, id="empty_path"),
    ],
)
async def test_execute_sends_error_for_invalid_path(
    check_file_exists_action, mock_comm, data
):
    """Test that execute sends error response for invalid liveCodeFilePath."""
    # Act
    await check_file_exists_action.execute(mock_comm, data)

    # Assert
    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CHECK_FILE_EXISTS.value
    assert call_args["exists"] is False
    assert call_args["error"] is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "file_exists,expected_exists",
    [
        pytest.param(True, True, id="existing_file"),
        pytest.param(False, False, id="non_existing_file"),
    ],
)
async def test_execute_returns_file_exists_status(
    check_file_exists_action, mock_comm, tmp_path, file_exists, expected_exists
):
    """Test that execute returns correct exists status and logs debug message."""
    # Arrange
    test_file = tmp_path / "test_file.m"
    if file_exists:
        test_file.write_text("% test content")

    data = {"liveCodeFilePath": str(test_file)}

    # Act
    await check_file_exists_action.execute(mock_comm, data)

    # Assert
    mock_comm.send.assert_called_once()
    call_args = mock_comm.send.call_args[0][0]
    assert call_args["action"] == ActionTypes.CHECK_FILE_EXISTS.value
    assert call_args["exists"] is expected_exists
    assert call_args["error"] is None
    assert check_file_exists_action.log.debug.call_count >= 1


@pytest.mark.asyncio
async def test_execute_handles_tilde_expansion(
    check_file_exists_action, mock_comm, mocker
):
    """Test that execute properly expands ~ in file paths."""
    # Arrange
    mock_path = mocker.MagicMock(spec=Path)
    mock_expanded = mocker.MagicMock()
    mock_resolved = mocker.MagicMock()
    mock_path.expanduser.return_value = mock_expanded
    mock_expanded.resolve.return_value = mock_resolved
    mock_resolved.exists.return_value = True

    mocker.patch(
        "jupyter_matlab_kernel.comms.labextension.actions.check_file_exists_action.Path",
        return_value=mock_path,
    )

    data = {"liveCodeFilePath": "~/test_file.m"}

    # Act
    await check_file_exists_action.execute(mock_comm, data)

    # Assert
    mock_path.expanduser.assert_called_once()
    mock_expanded.resolve.assert_called_once()
    mock_resolved.exists.assert_called_once()


@pytest.mark.asyncio
async def test_execute_logs_error_on_validation_failure(
    check_file_exists_action, mock_comm
):
    """Test that execute logs error when validation fails."""
    # Arrange
    data = {}

    # Act
    await check_file_exists_action.execute(mock_comm, data)

    # Assert
    check_file_exists_action.log.error.assert_called_once()
    error_message = check_file_exists_action.log.error.call_args[0][0]
    assert "CheckFileExists action failed" in error_message
