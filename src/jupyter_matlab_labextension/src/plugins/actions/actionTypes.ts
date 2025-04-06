// Copyright 2025 The MathWorks, Inc.

export enum ActionTypes {
  CONVERT = 'convert',
  EDIT = 'edit',
  MATLAB_STATUS = 'matlab_status',
  START_MATLAB_PROXY = 'start_matlab_proxy',
  CHECK_FILE_EXISTS = 'check_file_exists',
  UNKNOWN = 'unknown', // Default action type when none of the above match
}
