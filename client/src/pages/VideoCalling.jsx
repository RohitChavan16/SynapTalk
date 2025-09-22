import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Phone, PhoneOff, 
  RotateCcw, Volume2, VolumeX, Pause, Play,
  Maximize2, RotateCw, Settings
} from 'lucide-react';
import { WebRTCService } from '../services/WebRTCService';
import { SignalingService } from '../services/SignalingService';

const VideoCalling = ({ 
  roomId,
  userId,
  onCallEnd,
  remoteUserId = null 
}) => {
  // State management
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
  const webRTCService = useRef(null);
  const signalingService = useRef(null);
  const callStartTime = useRef(null);
  const callTimer = useRef(null);

  // Initialize services
  useEffect(() => {
    const initializeCall = async () => {
      try {
        setIsLoading(true);
        
        // Initialize signaling service
        signalingService.current = new SignalingService(
          process.env.REACT_APP_SIGNALING_SERVER_URL || 'ws://localhost:8080'
        );
        
        // Initialize WebRTC service
        webRTCService.current = new WebRTCService({
          onRemoteStream: handleRemoteStream,
          onConnectionStateChange: handleConnectionStateChange,
          onIceCandidate: handleIceCandidate,
          onNetworkStats: handleNetworkStats
        });

        // Set up signaling service callbacks
        signalingService.current.onMessage = handleSignalingMessage;
        signalingService.current.onConnected = () => {
          console.log('Signaling connected');
          joinRoom();
        };

        await signalingService.current.connect();
        await startLocalStream();
        
        setIsLoading(false);
        startCallTimer();
        
      } catch (error) {
        console.error('Failed to initialize call:', error);
        setCallStatus('Connection failed');
        setIsLoading(false);
      }
    };

    initializeCall();

    return () => {
      cleanup();
    };
  }, [roomId, userId]);

  // Start local video stream
  const startLocalStream = async () => {
    try {
      const stream = await webRTCService.current.startLocalStream({
        video: { facingMode: currentCamera },
        audio: true
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  // Join room for signaling
  const joinRoom = () => {
    signalingService.current.send({
      type: 'join-room',
      roomId,
      userId
    });
  };

  // Handle signaling messages
  const handleSignalingMessage = async (message) => {
    switch (message.type) {
      case 'user-joined':
        if (message.userId !== userId) {
          setCallStatus('User joined');
          await webRTCService.current.createOffer();
        }
        break;
      case 'offer':
        await webRTCService.current.handleOffer(message.offer);
        break;
      case 'answer':
        await webRTCService.current.handleAnswer(message.answer);
        break;
      case 'ice-candidate':
        await webRTCService.current.handleIceCandidate(message.candidate);
        break;
      case 'user-left':
        setCallStatus('User left');
        handleUserLeft();
        break;
      case 'call-ended':
        handleCallEnded();
        break;
    }
  };

  // Handle remote stream
  const handleRemoteStream = (stream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      setIsConnected(true);
      setCallStatus('Connected');
    }
  };

  // Handle connection state changes
  const handleConnectionStateChange = (state) => {
    setCallStatus(state);
    updateConnectionQuality(state);
  };

  // Handle ICE candidates
  const handleIceCandidate = (candidate) => {
    signalingService.current.send({
      type: 'ice-candidate',
      candidate,
      roomId,
      userId
    });
  };

  // Handle network statistics
  const handleNetworkStats = (stats) => {
    setNetworkStats(stats);
  };

  // Update connection quality indicator
  const updateConnectionQuality = (state) => {
    const qualityMap = {
      'connected': 5,
      'connecting': 3,
      'disconnected': 1,
      'failed': 0,
      'closed': 0
    };
    setConnectionQuality(qualityMap[state] || 2);
  };

  // Start call duration timer
  const startCallTimer = () => {
    callStartTime.current = new Date();
    callTimer.current = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now - callStartTime.current) / 1000);
      setCallDuration(duration);
    }, 1000);
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Control functions
  const toggleMute = useCallback(async () => {
    const newMutedState = await webRTCService.current.toggleAudio();
    setIsAudioMuted(newMutedState);
  }, []);

  const toggleVideo = useCallback(async () => {
    const newVideoState = await webRTCService.current.toggleVideo();
    setIsVideoEnabled(newVideoState);
  }, []);

  const toggleHold = useCallback(async () => {
    const newHoldState = await webRTCService.current.toggleHold();
    setIsOnHold(newHoldState);
  }, []);

  const switchCamera = useCallback(async () => {
    try {
      const newCamera = currentCamera === 'user' ? 'environment' : 'user';
      await webRTCService.current.switchCamera(newCamera);
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
    signalingService.current.send({
      type: 'end-call',
      roomId,
      userId
    });
    cleanup();
    onCallEnd();
  }, [roomId, userId, onCallEnd]);

  const switchVideoPositions = () => {
    // Swap video element contents
    const localStream = localVideoRef.current?.srcObject;
    const remoteStream = remoteVideoRef.current?.srcObject;
    
    if (localVideoRef.current && remoteVideoRef.current) {
      localVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.srcObject = localStream;
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

  // Handle user left
  const handleUserLeft = () => {
    setIsConnected(false);
    setCallStatus('User left');
  };

  // Handle call ended
  const handleCallEnded = () => {
    cleanup();
    onCallEnd();
  };

  // Cleanup function
  const cleanup = () => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
    }
    webRTCService.current?.cleanup();
    signalingService.current?.disconnect();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch (e.key.toLowerCase()) {
        case 'm':
          toggleMute();
          break;
        case 'v':
          toggleVideo();
          break;
        case 'h':
          toggleHold();
          break;
        case 'escape':
          endCall();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [toggleMute, toggleVideo, toggleHold, endCall]);

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
            <p className="text-xl">Connecting...</p>
          </div>
        </div>
      )}

      {/* Remote Video (Main/Large) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover bg-gray-800"
        poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjOTk5IiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+V2FpdGluZyBmb3IgcmVtb3RlIHZpZGVvLi4uPC90ZXh0Pjwvc3ZnPg=="
      />

      {/* Local Video (Small/PiP) */}
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

      {/* Mobile Responsive Adjustments */}
      <style jsx>{`
        @media (max-width: 768px) {
          .absolute.bottom-8.left-1/2 > div {
            flex-wrap: wrap;
            gap: 0.75rem;
            padding: 1rem;
          }
          .absolute.bottom-8.left-1/2 button {
            padding: 0.75rem;
          }
          .absolute.bottom-5.right-5 video {
            width: 7rem;
            height: 5.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default VideoCalling;