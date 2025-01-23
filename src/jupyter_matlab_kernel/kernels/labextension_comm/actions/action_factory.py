# Copyright 2024 The MathWorks, Inc.

from typing import Union
from jupyter_matlab_kernel.kernels.labextension_comm.actions import UnknownAction
from jupyter_matlab_kernel.kernels.labextension_comm.actions.types import ActionTypes


class ActionFactory:
    """
    ActionFactory class for determining and returning the appropriate Action class.

    This class provides a static method to decide between different Action
    implementations based on the supplied Action Type.
    """

    @staticmethod
    def create_action(action_type, kernel) -> Union[UnknownAction]:
        """Determines and returns the appropriate Action to use

        Args:
            action_type (ActionTypes): Type of the action
            kernel (BaseMATLABKernel): The MATLAB Kernel being used

        Returns:
            Union[UnknownAction]:
        """
        # Temporary dummy action
        if ActionTypes.DUMMY.value == action_type:
            raise TypeError("Not supposed to call dummy action")
        # Add more elif conditions when there are new action types
        else:
            return UnknownAction(kernel)
