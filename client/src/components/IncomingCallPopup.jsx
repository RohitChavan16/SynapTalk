import React, { useContext } from "react";
import { CallContext } from "../../context/CallContext";
import { AuthContext } from "../../context/AuthContext";

const IncomingCallPopup = () => {
  const { incomingCall, acceptCall, rejectCall } = useContext(CallContext);
  const { authUser } = useContext(AuthContext);

  if (!incomingCall) return null; // no incoming call, render nothing

  return (
    <div className="fixed top-20 right-5 z-50 bg-gray-800/90 p-4 rounded-lg shadow-lg border border-gray-600 w-72">
      <h2 className="text-white font-semibold text-sm">Incoming Call</h2>
      <p className="text-gray-300 text-xs mt-1">
        From: {incomingCall.from === authUser._id ? "You" : incomingCall.from}
      </p>

      <div className="flex justify-between mt-4">
        <button
          onClick={acceptCall}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-md text-sm"
        >
          Accept
        </button>
        <button
          onClick={rejectCall}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded-md text-sm"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default IncomingCallPopup;
