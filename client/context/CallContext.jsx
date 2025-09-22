// context/CallContext.jsx
import React, { createContext, useState, useContext } from "react";
import { AuthContext } from "./AuthContext";

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { authUser } = useContext(AuthContext);
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState("");

  // caller = authUser._id, callee = calleeId
  const handleJoinCall = (calleeId) => {
    if (!authUser?._id || !calleeId) return;

    // Unique deterministic room ID based on both user IDs
    const room = `room_${[authUser._id, calleeId].sort().join("_")}`;
    setRoomId(room);
    setIsInCall(true);

    // Optional: call your backend API to create/check room
    console.log("Joining room:", room);
  };

  const handleCallEnd = () => {
    setIsInCall(false);
    setRoomId("");
  };

  return (
    <CallContext.Provider
      value={{
        isInCall,
        roomId,
        handleJoinCall,
        handleCallEnd,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
