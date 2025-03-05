# Copyright 2025 The MathWorks, Inc.

from . import ActionCommand, ActionTypes


class NudgeAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self):
        pass

    async def execute(self, comm, msg):
        try:            
            comm.send(
                {
                    "action": ActionTypes.NUDGE.value,
                    "msg": msg
                   
                }
            )
        except Exception as err:
            self.log.error(f"Error sending Nudge: {err}")
            comm.send(
                {
                    "action": ActionTypes.NUDGE.value,
                    "error": str(err),
                }
            )
