import numpy as np
import cv2
import base64
from typing import Dict, Optional, List
from .simple_rppg_processor import SimpleRPPGProcessor, FaceDetector, SignalQualityChecker

class RealTimeRPPGProcessor:
    """
    Real-time rPPG processor with a sliding window buffer.
    Designed for use with WebSocket streams.
    """
    
    def __init__(
        self,
        method: str = 'POS',
        window_seconds: int = 6,
        target_fps: int = 30,
        update_interval_frames: int = 30,
        use_mediapipe: bool = True
    ):
        self.method = method.upper()
        self.target_fps = target_fps
        self.window_size = window_seconds * target_fps
        self.update_interval = update_interval_frames
        
        # Buffers
        self.frame_buffer = []  # List of processed face frames (128x128)
        self.frame_count = 0
        
        # Components from SimpleRPPGProcessor
        self.face_detector = FaceDetector(use_mediapipe=use_mediapipe)
        self.processor = SimpleRPPGProcessor(
            method=method,
            target_fps=target_fps,
            use_mediapipe=use_mediapipe,
            check_quality=True
        )
        
    def process_frame(self, base64_frame: str) -> Optional[Dict]:
        """
        Process a single frame from the stream.
        
        Args:
            base64_frame: Base64 encoded JPEG/PNG frame.
            
        Returns:
            Dict with HR/BVP if an update is available, else None.
        """
        try:
            # 1. Decode frame
            nparr = np.frombuffer(base64.b64decode(base64_frame.split(',')[-1]), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                print("Error: Could not decode frame")
                return {"error": "Invalid frame data"}
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 2. Detect and process face
            face_box = self.face_detector.detect(frame_rgb, enlarge_coef=1.5)
            
            if face_box:
                x, y, w, h = face_box
                # Basic bounds check (simplified for logging)
                face_crop = frame_rgb[max(0,y):min(frame_rgb.shape[0],y+h), max(0,x):min(frame_rgb.shape[1],x+w)]
                if face_crop.size > 0:
                    face_resized = cv2.resize(face_crop, (128, 128), interpolation=cv2.INTER_AREA)
                    self.frame_buffer.append(face_resized)
            else:
                if self.frame_count % 30 == 0:
                    print("Warning: No face detected in current frame")
            
            # 3. Maintain sliding window
            if len(self.frame_buffer) > self.window_size:
                self.frame_buffer.pop(0)
            
            self.frame_count += 1
            
            # 4. Periodically calculate HR
            if len(self.frame_buffer) >= self.window_size and self.frame_count % self.update_interval == 0:
                print(f"Calculating HR for buffer of size {len(self.frame_buffer)}")
                return self._calculate_realtime_stats()
            
            return None
            
        except Exception as e:
            return {"error": str(e)}
            
    def _calculate_realtime_stats(self) -> Dict:
        """Perform analysis on the current buffer."""
        frames_array = np.array(self.frame_buffer)
        
        # Extract BVP using the method logic from processor
        bvp = self.processor._extract_bvp(frames_array, self.target_fps)
        
        # Calculate HR
        hr = self.processor._calculate_hr(bvp, self.target_fps)
        
        # Signal quality
        quality = SignalQualityChecker.check_signal_quality(bvp, self.target_fps)
        
        # BVP signal for graphing (last 30 samples for real-time vibe)
        # Or full buffer if the frontend handles it
        return {
            "success": True,
            "heart_rate_bpm": round(hr, 2),
            "quality": quality,
            "bvp_latest": bvp[-30:].tolist() if len(bvp) >= 30 else bvp.tolist(),
            "buffer_fullness": len(self.frame_buffer) / self.window_size
        }
