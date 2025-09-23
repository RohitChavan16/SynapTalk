import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Phone, PhoneOff, 
  RotateCcw, Volume2, VolumeX, Pause, Play,
  Maximize2, RotateCw, Settings
} from 'lucide-react';
import { io } from "socket.io-client";

const VideoCalling = ({ 
  roomId,
  userId,
  onCallEnd,
  remoteUserId = null,
  signalingServerUrl = 'http://localhost:5001'
}) => {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentCamera, setCurrentCamera] = useState('user');
  const [connectionQuality, setConnectionQuality] = useState(5);
  const [isRecording, setIsRecording] = useState(false);
  const [showNetworkStats, setShowNetworkStats] = useState(false);
  const [networkStats, setNetworkStats] = useState({
    bitrate: '0 Mbps',
    latency: '0ms',
    packetLoss: '0%',
    resolution: 'Unknown'
  });

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const socket = useRef(null);
  const callStartTime = useRef(null);
  const callTimer = useRef(null);
  const isInitialized = useRef(false);

  // WebRTC config
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up video call...");
    
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      localStream.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    isInitialized.current = false;
  }, []);

  // Initialize call
  useEffect(() => {
    const initializeCall = async () => {
      if (isInitialized.current) return;
      
      try {
        setIsLoading(true);
        setCallStatus('Initializing...');
        isInitialized.current = true;

        // Initialize Socket.IO connection
        await initializeSocket();

        // Initialize WebRTC peer connection
        initializePeerConnection();

        // Start local stream with better error handling
        await startLocalStream();

        // Join call room
        joinCallRoom();

        setIsLoading(false);
        startCallTimer();

      } catch (error) {
        console.error('Failed to initialize call:', error);
        setCallStatus('Connection failed: ' + error.message);
        setIsLoading(false);
      }
    };

    initializeCall();

    return cleanup;
  }, [roomId, userId, cleanup]);

  // Socket.IO Setup
  const initializeSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        if (socket.current) {
          socket.current.disconnect();
        }

        socket.current = io(signalingServerUrl, {
          query: { userId },
          transports: ["websocket"],
          forceNew: true
        });

        socket.current.on('connect', () => {
          console.log('Socket connected:', socket.current.id);
          setCallStatus('Connected to server');
          resolve();
        });

        // WebRTC signaling handlers
        socket.current.on('webrtc-offer', async (data) => {
          console.log('Received WebRTC offer:', data);
          await handleOffer(data.offer);
        });

        socket.current.on('webrtc-answer', async (data) => {
          console.log('Received WebRTC answer:', data);
          await handleAnswer(data.answer);
        });

        socket.current.on('webrtc-ice-candidate', async (data) => {
          console.log('Received ICE candidate:', data);
          await handleIceCandidate(data.candidate);
        });

        socket.current.on('user-joined-call', async (data) => {
          if (data.userId !== userId) {
            console.log('User joined call:', data.userId);
            setCallStatus('User joined');
            // Small delay to ensure both users are ready
            setTimeout(() => createOffer(), 1000);
          }
        });

        socket.current.on('user-left-call', (data) => {
          console.log('User left call:', data);
          setCallStatus('User left');
          handleUserLeft();
        });

        socket.current.on('call-ended', (data) => {
          console.log('Call ended:', data);
          handleCallEnded();
        });

        socket.current.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          reject(err);
        });

      } catch (error) {
        reject(error);
      }
    });
  };

  const sendSignalingMessage = (message) => {
    if (socket.current && socket.current.connected) {
      console.log('Sending signaling message:', message.type);
      socket.current.emit(message.type, message);
    } else {
      console.error('Cannot send message - socket not connected');
    }
  };

  // WebRTC Setup
  const initializePeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    peerConnection.current = new RTCPeerConnection(rtcConfig);

    peerConnection.current.ontrack = (event) => {
      console.log('Received remote stream');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
        setCallStatus('Connected');
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: 'webrtc-ice-candidate',
          roomId,
          targetUserId: remoteUserId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState;
      console.log('Connection state:', state);
      setCallStatus(state);
      updateConnectionQuality(state);
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('ICE connection state:', state);
      if (state === 'disconnected' || state === 'failed') {
        setCallStatus('Connection lost');
        setConnectionQuality(0);
      }
    };
  };

  const startLocalStream = async () => {
    try {
      // Stop any existing stream first
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }

      const constraints = {
        video: { 
          facingMode: currentCamera,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      console.log('Requesting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStream.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (peerConnection.current) {
        // Remove existing tracks
        const senders = peerConnection.current.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            peerConnection.current.removeTrack(sender);
          }
        });

        // Add new tracks
        stream.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, stream);
          console.log(`Added ${track.kind} track`);
        });
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // Fallback: try audio only
      if (error.name === 'NotReadableError' || error.name === 'NotAllowedError') {
        try {
          console.log('Trying audio-only fallback...');
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          localStream.current = audioOnlyStream;
          setIsVideoEnabled(false);
          
          if (peerConnection.current) {
            audioOnlyStream.getTracks().forEach(track => {
              peerConnection.current.addTrack(track, audioOnlyStream);
            });
          }
          
          return audioOnlyStream;
        } catch (audioError) {
          console.error('Audio-only fallback failed:', audioError);
          throw new Error('Cannot access camera or microphone. Please check permissions and ensure no other application is using them.');
        }
      }
      throw error;
    }
  };

  const joinCallRoom = () => {
    sendSignalingMessage({
      type: 'join-call-room',
      roomId,
      userInfo: { userId }
    });
  };

  // WebRTC signaling handlers
  const createOffer = async () => {
    if (!peerConnection.current) return;
    
    try {
      console.log('Creating offer...');
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.current.setLocalDescription(offer);
      
      sendSignalingMessage({ 
        type: 'webrtc-offer', 
        roomId, 
        targetUserId: remoteUserId, 
        offer 
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer) => {
    if (!peerConnection.current) return;
    
    try {
      console.log('Handling offer...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      sendSignalingMessage({ 
        type: 'webrtc-answer', 
        roomId, 
        targetUserId: remoteUserId, 
        answer 
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    if (!peerConnection.current) return;
    
    try {
      console.log('Handling answer...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    if (!peerConnection.current) return;
    
    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Utility Functions
  const updateConnectionQuality = (state) => {
    const qualityMap = { 
      connected: 5, 
      connecting: 3, 
      disconnected: 1, 
      failed: 0, 
      closed: 0 
    };
    setConnectionQuality(qualityMap[state] || 2);
  };

  const startCallTimer = () => {
    callStartTime.current = new Date();
    callTimer.current = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now - callStartTime.current) / 1000);
      setCallDuration(duration);
    }, 1000);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  };

  // Control Functions
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        sendSignalingMessage({ 
          type: 'call-status-update', 
          roomId, 
          status: { audio: audioTrack.enabled } 
        });
      }
    }
  }, [roomId]);

  const toggleVideo = useCallback(() => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        sendSignalingMessage({ 
          type: 'call-status-update', 
          roomId, 
          status: { video: videoTrack.enabled } 
        });
      }
    }
  }, [roomId]);

  const toggleHold = useCallback(() => {
    if (localStream.current) {
      const tracks = localStream.current.getTracks();
      const isCurrentlyHeld = tracks.some(track => !track.enabled);
      tracks.forEach(track => { track.enabled = isCurrentlyHeld; });
      setIsOnHold(!isCurrentlyHeld);
    }
  }, []);

  const switchCamera = useCallback(async () => {
    try {
      const newCamera = currentCamera === 'user' ? 'environment' : 'user';
      if (!localStream.current) return;

      const currentVideoTrack = localStream.current.getVideoTracks()[0];
      if (currentVideoTrack) currentVideoTrack.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newCamera }, 
        audio: false 
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const sender = peerConnection.current?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);

      const audioTrack = localStream.current.getAudioTracks()[0];
      localStream.current = new MediaStream([newVideoTrack, audioTrack].filter(Boolean));

      if (localVideoRef.current) localVideoRef.current.srcObject = localStream.current;
      setCurrentCamera(newCamera);
    } catch (error) { 
      console.error('Error switching camera:', error); 
    }
  }, [currentCamera]);

  const toggleSpeaker = useCallback(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerOn;
      setIsSpeakerOn(!isSpeakerOn);
    }
  }, [isSpeakerOn]);

  const endCall = useCallback(() => {
    console.log('Ending call...');
    
    // Send end call message to other participants
    sendSignalingMessage({ 
      type: 'end-call', 
      roomId, 
      reason: 'user_hangup' 
    });

    // Clean up and call the onCallEnd callback
    cleanup();
    onCallEnd();
  }, [roomId, onCallEnd, cleanup]);

  const switchVideoPositions = () => {
    const localStreamObj = localVideoRef.current?.srcObject;
    const remoteStreamObj = remoteVideoRef.current?.srcObject;
    if (localVideoRef.current && remoteVideoRef.current) {
      localVideoRef.current.srcObject = remoteStreamObj;
      remoteVideoRef.current.srcObject = localStreamObj;
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (localVideoRef.current) {
        await localVideoRef.current.requestPictureInPicture();
      }
    } catch (error) { 
      console.error('PiP error:', error); 
    }
  };

  const handleUserLeft = () => { 
    setIsConnected(false); 
    setCallStatus('User left'); 
  };

  const handleCallEnded = () => { 
    console.log('Call ended by remote user');
    cleanup(); 
    onCallEnd(); 
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
            <p className="text-xl">Connecting...</p>
            <p className="text-sm mt-2">{callStatus}</p>
          </div>
        </div>
      )}

      {/* Remote Video (Main/Large) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover bg-gray-800"
      />

      {/* Local Video */}
      <div className="absolute bottom-5 right-5 group">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          onClick={switchVideoPositions}
          className="w-48 h-36 md:w-52 md:h-40 rounded-xl border-2 border-white shadow-2xl cursor-pointer transition-all duration-300 hover:scale-105 hover:border-green-400 bg-gray-800"
        />
          
        {/* PiP Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePiP();
            }}
            className="p-1 bg-black bg-opacity-60 rounded text-white hover:bg-opacity-80 transition-all duration-200"
            title="Picture in Picture"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              switchCamera();
            }}
            className="p-1 bg-black bg-opacity-60 rounded text-white hover:bg-opacity-80 transition-all duration-200"
            title="Flip Camera"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {/* Call Information */}
      <div className="absolute top-6 left-6 bg-black bg-opacity-70 backdrop-blur-md rounded-xl p-4 text-white">
        <div className="text-xl font-semibold mb-1">
          {formatDuration(callDuration)}
        </div>
        <div className="text-sm opacity-80">{callStatus}</div>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        {isAudioMuted && (
          <div className="bg-red-500 bg-opacity-90 backdrop-blur-md rounded-full px-3 py-1 text-white text-xs flex items-center gap-1">
            <MicOff size={12} />
            <span>Muted</span>
          </div>
        )}
        {isOnHold && (
          <div className="bg-orange-500 bg-opacity-90 backdrop-blur-md rounded-full px-3 py-1 text-white text-xs flex items-center gap-1 animate-pulse">
            <Pause size={12} />
            <span>On Hold</span>
          </div>
        )}
        {isRecording && (
          <div className="bg-red-600 bg-opacity-90 backdrop-blur-md rounded-full px-3 py-1 text-white text-xs flex items-center gap-1 animate-pulse">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
            <span>Recording</span>
          </div>
        )}
      </div>

      {/* Connection Quality Indicator */}
      <div className="absolute bottom-48 right-6 flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-1 h-5 rounded-full transition-all duration-300 ${
              i < connectionQuality 
                ? 'bg-green-400 opacity-100' 
                : 'bg-gray-500 opacity-30'
            }`}
          />
        ))}
      </div>

      {/* Network Stats */}
      {showNetworkStats && (
        <div className="absolute top-1/2 right-6 transform -translate-y-1/2 bg-black bg-opacity-80 backdrop-blur-md rounded-lg p-3 text-white text-xs font-mono">
          <div>Bitrate: {networkStats.bitrate}</div>
          <div>Latency: {networkStats.latency}</div>
          <div>Loss: {networkStats.packetLoss}</div>
          <div>Quality: {networkStats.resolution}</div>
        </div>
      )}

      {/* Control Panel */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-4 bg-black bg-opacity-80 backdrop-blur-md rounded-3xl p-5 border border-gray-700">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`relative p-4 rounded-full transition-all duration-300 hover:scale-110 ${
              isAudioMuted
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            } text-white shadow-lg hover:shadow-xl`}
            title="Mute/Unmute"
          >
            {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video Button */}
          <button
            onClick={toggleVideo}
            className={`relative p-4 rounded-full transition-all duration-300 hover:scale-110 ${
              isVideoEnabled
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-red-500 hover:bg-red-600'
            } text-white shadow-lg hover:shadow-xl`}
            title="Turn camera on/off"
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          {/* Hold Button */}
          <button
            onClick={toggleHold}
            className={`relative p-4 rounded-full transition-all duration-300 hover:scale-110 ${
              isOnHold
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-orange-500 hover:bg-orange-600'
            } text-white shadow-lg hover:shadow-xl`}
            title="Hold/Unhold"
          >
            {isOnHold ? <Play size={24} /> : <Pause size={24} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="relative p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl animate-pulse"
            title="End call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Switch Camera Button */}
          <button
            onClick={switchCamera}
            className="relative p-4 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl"
            title="Switch camera"
          >
            <RotateCcw size={24} />
          </button>

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={`relative p-4 rounded-full transition-all duration-300 hover:scale-110 ${
              isSpeakerOn
                ? 'bg-gray-600 hover:bg-gray-700'
                : 'bg-red-500 hover:bg-red-600'
            } text-white shadow-lg hover:shadow-xl`}
            title="Speaker on/off"
          >
            {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowNetworkStats(!showNetworkStats)}
            className="relative p-4 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl"
            title="Show network stats"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCalling;