#!/usr/bin/env python3
"""
🎥 WebRTC Video Server for Windows 11
Streams video from webcam via WebRTC
"""

import asyncio
import json
import logging
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, VideoStreamTrack
from av import VideoFrame
import cv2
import threading
from collections import defaultdict

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store peer connections and signaling data
pcs = {}
signaling_data = defaultdict(lambda: {
    'answer': None,
    'candidates': []
})

class VideoCapture:
    """Capture video from webcam"""
    def __init__(self, device_id=0):
        self.cap = cv2.VideoCapture(device_id)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        logger.info(f"📹 Webcam initialized: {device_id}")

    def read_frame(self):
        ret, frame = self.cap.read()
        if ret:
            return frame
        return None

    def close(self):
        self.cap.release()

# Global video capture
video_capture = VideoCapture(0)

async def send_video_frames(pc, device_id):
    """Send video frames from webcam to peer"""
    logger.info(f"🎬 Starting video stream for device: {device_id}")
    
    # Get video sender
    video_sender = None
    for sender in pc.getSenders():
        if sender.track and sender.track.kind == 'video':
            video_sender = sender
            break
    
    if not video_sender:
        logger.warning(f"⚠️  No video sender found for {device_id}")
        return

    frame_count = 0
    while pc.connectionState == 'connected':
        try:
            frame = video_capture.read_frame()
            if frame is not None:
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Create video frame
                video_frame = VideoFrame.from_ndarray(frame_rgb, format="rgb24")
                
                # Send frame
                await video_sender.send(video_frame)
                
                frame_count += 1
                if frame_count % 30 == 0:
                    logger.info(f"📤 Sent {frame_count} frames to {device_id}")
            
            await asyncio.sleep(0.033)  # ~30fps
        except Exception as e:
            logger.error(f"❌ Error sending frame: {e}")
            break
    
    logger.info(f"🛑 Video stream stopped for device: {device_id}")

async def handle_offer(request):
    """Handle WebRTC offer from client"""
    try:
        data = await request.json()
        device_id = data.get('deviceId', 'unknown')
        
        logger.info(f"📨 Received offer from device: {device_id}")
        
        # Create peer connection
        pc = RTCPeerConnection()
        pcs[device_id] = pc
        
        # Add video track
        logger.info(f"🎥 Adding video track for {device_id}")
        
        class LocalVideoTrack(VideoStreamTrack):
            """A video track that returns frames from the webcam"""
            async def recv(self):
                pts, time_base = await self.next_timestamp()
                frame = video_capture.read_frame()
                if frame is not None:
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    video_frame = VideoFrame.from_ndarray(frame_rgb, format="rgb24")
                    video_frame.pts = pts
                    video_frame.time_base = time_base
                    return video_frame
                else:
                    # Return a black frame if no frame available
                    black_frame = VideoFrame.from_ndarray(
                        cv2.cvtColor(
                            cv2.imread('placeholder.png') or cv2.zeros((720, 1280, 3), dtype='uint8'),
                            cv2.COLOR_BGR2RGB
                        ),
                        format="rgb24"
                    )
                    black_frame.pts = pts
                    black_frame.time_base = time_base
                    return black_frame
        
        video_track = LocalVideoTrack()
        pc.addTrack(video_track)
        
        # Handle ICE candidates
        @pc.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate:
                logger.info(f"🧊 New ICE candidate for {device_id}")
                signaling_data[device_id]['candidates'].append({
                    'candidate': candidate.candidate,
                    'sdpMLineIndex': candidate.sdpMLineIndex,
                    'sdpMid': candidate.sdpMid,
                })
        
        # Handle connection state changes
        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"🔗 Connection state for {device_id}: {pc.connectionState}")
            if pc.connectionState == 'connected':
                # Start sending video frames
                asyncio.create_task(send_video_frames(pc, device_id))
            elif pc.connectionState in ['failed', 'closed']:
                if device_id in pcs:
                    del pcs[device_id]
                if device_id in signaling_data:
                    del signaling_data[device_id]
        
        # Set remote description (offer)
        offer = RTCSessionDescription(sdp=data['sdp'], type='offer')
        await pc.setRemoteDescription(offer)
        
        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        logger.info(f"✅ Answer created for {device_id}")
        
        # Store answer for polling
        signaling_data[device_id]['answer'] = {
            'sdp': pc.localDescription.sdp,
            'type': 'answer'
        }
        
        # Return answer immediately
        return web.json_response({
            'type': 'answer',
            'sdp': pc.localDescription.sdp,
        })
    
    except Exception as e:
        logger.error(f"❌ Error handling offer: {e}")
        return web.json_response({'error': str(e)}, status=400)

async def handle_ice_candidate(request):
    """Handle ICE candidate from client"""
    try:
        data = await request.json()
        device_id = data.get('deviceId', 'unknown')
        
        if device_id in pcs:
            pc = pcs[device_id]
            candidate_data = data.get('candidate', {})
            
            candidate = RTCIceCandidate(
                candidate=candidate_data.get('candidate'),
                sdpMLineIndex=candidate_data.get('sdpMLineIndex'),
                sdpMid=candidate_data.get('sdpMid'),
            )
            
            await pc.addIceCandidate(candidate)
            logger.info(f"🧊 ICE candidate added for {device_id}")
        
        return web.json_response({'status': 'ok'})
    
    except Exception as e:
        logger.error(f"❌ Error handling ICE candidate: {e}")
        return web.json_response({'error': str(e)}, status=400)

async def handle_poll(request):
    """Poll for answer and ICE candidates"""
    try:
        device_id = request.query.get('deviceId', 'unknown')
        
        response_data = {}
        
        # Send answer if available
        if device_id in signaling_data and signaling_data[device_id]['answer']:
            response_data.update(signaling_data[device_id]['answer'])
        
        # Send ICE candidates
        if device_id in signaling_data and signaling_data[device_id]['candidates']:
            response_data['candidates'] = signaling_data[device_id]['candidates']
            signaling_data[device_id]['candidates'] = []  # Clear after sending
        
        return web.json_response(response_data)
    
    except Exception as e:
        logger.error(f"❌ Error handling poll: {e}")
        return web.json_response({'error': str(e)}, status=400)

async def handle_health(request):
    """Health check endpoint"""
    return web.json_response({
        'status': 'healthy',
        'active_connections': len(pcs),
        'timestamp': str(asyncio.get_event_loop().time()),
    })

async def cleanup(app):
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down...")
    for device_id, pc in pcs.items():
        await pc.close()
    video_capture.close()

async def main():
    """Start WebRTC server"""
    
    # CORS middleware
    @web.middleware
    async def cors_middleware(request, handler):
        if request.method == 'OPTIONS':
            # Handle preflight request - return 200 OK
            response = web.Response(status=200)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
        else:
            response = await handler(request)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
    
    app = web.Application(middlewares=[cors_middleware])
    
    # Routes
    app.router.add_post('/signal', handle_offer)
    app.router.add_post('/signal/candidate', handle_ice_candidate)
    app.router.add_get('/signal', handle_poll)
    app.router.add_get('/health', handle_health)
    
    # Cleanup on shutdown
    app.on_cleanup.append(cleanup)
    
    logger.info("=" * 60)
    logger.info("🎥 WebRTC Video Server")
    logger.info("=" * 60)
    logger.info("📡 Server running on http://0.0.0.0:8080")
    logger.info("🎬 Video endpoint: /signal")
    logger.info("🏥 Health check: /health")
    logger.info("=" * 60)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    
    # Keep running
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
