# Copyright 2025 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path
import asyncio
from jupyter_matlab_kernel.mwi_comm_helpers import MWICommHelper


class MatlabStatusAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self):
        pass

    async def execute(self, comm, data):
        try:
            self.log.info("Fetching MATLAB proxy status...")
            (
                is_matlab_licensed,
                matlab_status,
                _,
            ) = await self.kernel.mwi_comm_helper.fetch_matlab_proxy_status()

            self.log.info("MatlabStatus action successful")
            comm.send(
                {
                    "action": ActionTypes.MATLAB_STATUS.value,
                    "matlabStatus": {
                        "isLicensed": is_matlab_licensed,
                        "status": matlab_status,
                    },
                    "error": None,
                }
            )
        except Exception as err:
            self.log.error(f"Error fetching MATLAB proxy status: {err}")
            comm.send(
                {
                    "action": ActionTypes.MATLAB_STATUS.value,
                    "matlabStatus": {},
                    "error": str(err),
                }
            )
