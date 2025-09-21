// services/WebRTCService.js
export class WebRTCService {
  constructor({
    onRemoteStream,
    onConnectionStateChange,
    onIceCandidate,
    onNetworkStats,
    iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  }) {
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onIceCandidate = onIceCandidate;
    this.onNetworkStats = onNetworkStats;
    this.iceServers = iceServers;
    this.isInitialized = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.statsInterval = null;

    this.initializePeerConnection();
    this.startStatsMonitoring();
  }

  /**
   * Initialize WebRTC peer connection with configuration
   */
  initializePeerConnection() {
    const configuration = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', this.peerConnection.signalingState);
    };

    this.isInitialized = true;
  }

  /**
   * Start local media stream
   */
  async startLocalStream(constraints = { video: true, audio: true }) {
    try {
      console.log('Starting local stream with constraints:', constraints);
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error(`Failed to access camera/microphone: ${error.message}`);
    }
  }

  /**
   * Create and send offer
   */
  async createOffer() {
    try {
      console.log('Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: false
      });

      await this.peerConnection.setLocalDescription(offer);
      
      // Send offer through signaling
      if (this.onIceCandidate) {
        // This would typically be sent through the signaling service
        console.log('Offer created and set as local description');
      }

      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(offer) {
    try {
      console.log('Handling offer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(answer) {
    try {
      console.log('Handling answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * Toggle audio mute/unmute
   */
  async toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('Audio toggled:', audioTrack.enabled ? 'unmuted' : 'muted');
        return !audioTrack.enabled; // Return muted state
      }
    }
    return false;
  }

  /**
   * Toggle video on/off
   */
  async toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('Video toggled:', videoTrack.enabled ? 'enabled' : 'disabled');
        return videoTrack.enabled; // Return enabled state
      }
    }
    return false;
  }

  /**
   * Toggle hold (pause/resume all tracks)
   */
  async toggleHold() {
    if (this.localStream) {
      const tracks = this.localStream.getTracks();
      const isCurrentlyHeld = tracks.some(track => !track.enabled);
      
      tracks.forEach(track => {
        track.enabled = isCurrentlyHeld;
      });
      
      console.log('Call', isCurrentlyHeld ? 'resumed' : 'held');
      return !isCurrentlyHeld; // Return hold state
    }
    return false;
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(facingMode = 'user') {
    try {
      console.log('Switching camera to:', facingMode);
      
      if (!this.localStream) {
        throw new Error('No local stream available');
      }

      // Stop current video track
      const currentVideoTrack = this.localStream.getVideoTracks()[0];
      if (currentVideoTrack) {
        currentVideoTrack.stop();
      }

      // Get new video stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace video track in peer connection
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Update local stream
      const audioTrack = this.localStream.getAudioTracks()[0];
      this.localStream = new MediaStream([newVideoTrack, audioTrack].filter(Boolean));

      console.log('Camera switched successfully');
      return this.localStream;
    } catch (error) {
      console.error('Error switching camera:', error);
      throw error;
    }
  }

  /**
   * Start recording the call
   */
  async startRecording() {
    try {
      if (this.localStream) {
        const options = {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 2500000
        };

        this.mediaRecorder = new MediaRecorder(this.localStream, options);
        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          
          // Create download link
          const a = document.createElement('a');
          a.href = url;
          a.download = `call-recording-${new Date().toISOString()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        this.mediaRecorder.start(1000); // Record in 1-second chunks
        console.log('Recording started');
        return true;
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording the call
   */
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      console.log('Recording stopped');
      return true;
    }
    return false;
  }

  /**
   * Start monitoring network statistics
   */
  startStatsMonitoring() {
    this.statsInterval = setInterval(async () => {
      if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
        try {
          const stats = await this.peerConnection.getStats();
          this.processStats(stats);
        } catch (error) {
          console.error('Error getting stats:', error);
        }
      }
    }, 2000);
  }

  /**
   * Process WebRTC statistics
   */
  processStats(stats) {
    let inboundRtp = null;
    let outboundRtp = null;
    let remoteInboundRtp = null;
    
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        inboundRtp = report;
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        outboundRtp = report;
      } else if (report.type === 'remote-inbound-rtp' && report.mediaType === 'video') {
        remoteInboundRtp = report;
      }
    });

    const networkStats = {
      bitrate: this.calculateBitrate(outboundRtp),
      latency: this.calculateLatency(remoteInboundRtp),
      packetLoss: this.calculatePacketLoss(remoteInboundRtp),
      resolution: this.getResolution(inboundRtp, outboundRtp)
    };

    if (this.onNetworkStats) {
      this.onNetworkStats(networkStats);
    }
  }

  /**
   * Calculate bitrate from RTP stats
   */
  calculateBitrate(report) {
    if (!report || !report.bytesSent) return '0 Mbps';
    
    const now = Date.now();
    if (!this.lastBitrateCheck) {
      this.lastBitrateCheck = { timestamp: now, bytes: report.bytesSent };
      return '0 Mbps';
    }
    
    const timeDiff = (now - this.lastBitrateCheck.timestamp) / 1000;
    const bytesDiff = report.bytesSent - this.lastBitrateCheck.bytes;
    const bitrate = (bytesDiff * 8) / timeDiff / 1000000; // Convert to Mbps
    
    this.lastBitrateCheck = { timestamp: now, bytes: report.bytesSent };
    
    return `${bitrate.toFixed(2)} Mbps`;
  }

  /**
   * Calculate latency from RTP stats
   */
  calculateLatency(report) {
    if (!report || typeof report.roundTripTime !== 'number') return '0ms';
    return `${Math.round(report.roundTripTime * 1000)}ms`;
  }

  /**
   * Calculate packet loss from RTP stats
   */
  calculatePacketLoss(report) {
    if (!report || !report.packetsLost || !report.packetsSent) return '0%';
    const lossPercentage = (report.packetsLost / report.packetsSent) * 100;
    return `${lossPercentage.toFixed(1)}%`;
  }

  /**
   * Get video resolution from RTP stats
   */
  getResolution(inbound, outbound) {
    const report = inbound || outbound;
    if (!report || !report.frameWidth || !report.frameHeight) return 'Unknown';
    return `${report.frameWidth}x${report.frameHeight}`;
  }

  /**
   * Share screen instead of camera
   */
  async shareScreen() {
    try {
      console.log('Starting screen share...');
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });

      const videoTrack = screenStream.getVideoTracks()[0];
      
      // Replace video track in peer connection
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(videoTrack);
      }

      // Handle screen share end
      videoTrack.addEventListener('ended', () => {
        console.log('Screen share ended');
        this.stopScreenShare();
      });

      this.screenStream = screenStream;
      console.log('Screen share started successfully');
      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  /**
   * Stop screen sharing and return to camera
   */
  async stopScreenShare() {
    try {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      // Return to camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      const videoTrack = cameraStream.getVideoTracks()[0];
      
      // Replace screen share track with camera track
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(videoTrack);
      }

      // Update local stream
      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        this.localStream = new MediaStream([videoTrack, audioTrack].filter(Boolean));
      }

      console.log('Returned to camera successfully');
      return this.localStream;
    } catch (error) {
      console.error('Error stopping screen share:', error);
      throw error;
    }
  }

  /**
   * Apply video filters/effects
   */
  async applyVideoFilter(filterType = 'none') {
    // This would require a more complex implementation with canvas processing
    // For now, we'll just log the intent
    console.log('Video filter would be applied:', filterType);
    
    // Possible filters: blur, brightness, contrast, sepia, grayscale, etc.
    // Implementation would involve:
    // 1. Create canvas element
    // 2. Draw video frames to canvas with filters
    // 3. Capture canvas stream
    // 4. Replace video track with processed stream
  }

  /**
   * Adjust video quality based on network conditions
   */
  async adjustQuality(quality = 'auto') {
    const constraints = {
      auto: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      high: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      medium: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
      low: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
    };

    try {
      const constraint = constraints[quality] || constraints.auto;
      
      // This would require restarting the video track with new constraints
      console.log('Quality adjustment would be applied:', constraint);
      
      // Implementation would involve:
      // 1. Stop current video track
      // 2. Get new stream with updated constraints
      // 3. Replace track in peer connection
      
    } catch (error) {
      console.error('Error adjusting quality:', error);
      throw error;
    }
  }

  /**
   * Get available media devices
   */
  async getMediaDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        videoInputs: devices.filter(device => device.kind === 'videoinput'),
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        audioOutputs: devices.filter(device => device.kind === 'audiooutput')
      };
    } catch (error) {
      console.error('Error getting media devices:', error);
      return { videoInputs: [], audioInputs: [], audioOutputs: [] };
    }
  }

  /**
   * Switch to specific media device
   */
  async switchToDevice(deviceId, deviceType = 'video') {
    try {
      const constraints = deviceType === 'video' 
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: false, audio: { deviceId: { exact: deviceId } } };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = deviceType === 'video' 
        ? newStream.getVideoTracks()[0]
        : newStream.getAudioTracks()[0];

      // Replace track in peer connection
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === deviceType
      );

      if (sender) {
        await sender.replaceTrack(newTrack);
      }

      // Update local stream
      if (this.localStream) {
        const existingTracks = this.localStream.getTracks()
          .filter(track => track.kind !== deviceType);
        this.localStream = new MediaStream([...existingTracks, newTrack]);
      }

      console.log(`Switched to ${deviceType} device:`, deviceId);
      return this.localStream;
    } catch (error) {
      console.error(`Error switching ${deviceType} device:`, error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('Cleaning up WebRTC resources...');
    
    // Stop stats monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Stop recording if active
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop screen share if active
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isInitialized = false;
    console.log('WebRTC cleanup completed');
  }

  /**
   * Get current connection statistics
   */
  async getConnectionStats() {
    if (!this.peerConnection) return null;
    
    try {
      const stats = await this.peerConnection.getStats();
      const result = {
        connectionState: this.peerConnection.connectionState,
        iceConnectionState: this.peerConnection.iceConnectionState,
        signalingState: this.peerConnection.signalingState,
        localCandidates: [],
        remoteCandidates: [],
        candidatePairs: []
      };

      stats.forEach((report) => {
        if (report.type === 'local-candidate') {
          result.localCandidates.push(report);
        } else if (report.type === 'remote-candidate') {
          result.remoteCandidates.push(report);
        } else if (report.type === 'candidate-pair') {
          result.candidatePairs.push(report);
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return null;
    }
  }
}