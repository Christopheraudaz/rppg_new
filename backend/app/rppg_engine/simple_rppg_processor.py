
"""
Simplified rPPG processor for production use.
Keeps validated algorithms from rPPG-Toolbox, removes research overhead.
"""

import os
import cv2
import numpy as np
import pandas as pd
from typing import Dict, Optional, Tuple, List
import warnings
from scipy import signal, sparse
import math
from tqdm import tqdm
import argparse

# Import validated rPPG methods from toolbox
import sys
from pathlib import Path

# Add current directory to path to allow imports when running as script
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

try:
    from .unsupervised_methods.methods.POS_WANG import POS_WANG
    from .unsupervised_methods.methods.CHROME_DEHAAN import CHROME_DEHAAN
    from .unsupervised_methods.methods.GREEN import GREEN
    from .unsupervised_methods import utils
except ImportError:
    try:
        from unsupervised_methods.methods.POS_WANG import POS_WANG
        from unsupervised_methods.methods.CHROME_DEHAAN import CHROME_DEHAAN
        from unsupervised_methods.methods.GREEN import GREEN
        from unsupervised_methods import utils
    except ImportError as e:
        print(f"ERROR: Could not import rPPG methods: {e}")
        print("Make sure you're running from rPPG-Toolbox root directory")
        exit(1)


class FaceDetector:
    """Face detection using MediaPipe (better than Haar Cascade)."""
    
    def __init__(self, use_mediapipe: bool = True):
        """
        Initialize face detector.
        
        Args:
            use_mediapipe: If True, use MediaPipe. If False, fallback to Haar Cascade.
        """
        self.use_mediapipe = use_mediapipe
        
        if use_mediapipe:
            try:
                import mediapipe as mp
                self.mp_face_detection = mp.solutions.face_detection
                self.detector = self.mp_face_detection.FaceDetection(
                    model_selection=0,  # 0 = close range (< 2m)
                    min_detection_confidence=0.5
                )
                print("✓ Using MediaPipe for face detection")
            except ImportError:
                warnings.warn(
                    "MediaPipe not installed. Install with:\n"
                    "  Apple Silicon: pip install mediapipe-silicon\n"
                    "  Intel/AMD/Other: pip install mediapipe"
                )
                self.use_mediapipe = False
                self._init_haar_cascade()
        else:
            self._init_haar_cascade()
    
    def _init_haar_cascade(self):
        """Fallback to Haar Cascade."""
        # Use absolute path relative to this file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cascade_path = os.path.join(base_dir, 'dataset', 'haarcascade_frontalface_default.xml')
        if os.path.exists(cascade_path):
            self.detector = cv2.CascadeClassifier(cascade_path)
            print("✓ Using Haar Cascade for face detection")
        else:
            raise FileNotFoundError(f"Haar Cascade file not found: {cascade_path}")
    
    def detect(self, frame: np.ndarray, enlarge_coef: float = 1.5) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect face in frame and return bounding box.
        
        Args:
            frame: RGB frame
            enlarge_coef: Factor to enlarge face box (e.g., 1.5 = 150% of detected size)
            
        Returns:
            (x, y, width, height) or None if no face detected
        """
        if self.use_mediapipe:
            return self._detect_mediapipe(frame, enlarge_coef)
        else:
            return self._detect_haar(frame, enlarge_coef)
    
    def _detect_mediapipe(self, frame: np.ndarray, enlarge_coef: float) -> Optional[Tuple[int, int, int, int]]:
        """Detect face using MediaPipe."""
        h, w = frame.shape[:2]
        
        # MediaPipe expects RGB
        results = self.detector.process(frame)
        
        if not results.detections:
            return None
        
        # Use first (most confident) detection
        detection = results.detections[0]
        bbox = detection.location_data.relative_bounding_box
        
        # Convert relative coordinates to absolute pixels
        x = int(bbox.xmin * w)
        y = int(bbox.ymin * h)
        width = int(bbox.width * w)
        height = int(bbox.height * h)
        
        # Enlarge box
        if enlarge_coef > 1.0:
            center_x = x + width // 2
            center_y = y + height // 2
            new_width = int(width * enlarge_coef)
            new_height = int(height * enlarge_coef)
            x = max(0, center_x - new_width // 2)
            y = max(0, center_y - new_height // 2)
            width = min(new_width, w - x)
            height = min(new_height, h - y)
        
        return (x, y, width, height)
    
    def _detect_haar(self, frame: np.ndarray, enlarge_coef: float) -> Optional[Tuple[int, int, int, int]]:
        """Detect face using Haar Cascade."""
        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        faces = self.detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        
        if len(faces) == 0:
            return None
        
        # Use largest face if multiple detected
        if len(faces) > 1:
            largest_idx = np.argmax(faces[:, 2] * faces[:, 3])
            face = faces[largest_idx]
        else:
            face = faces[0]
        
        x, y, w, h = face
        
        # Enlarge box
        if enlarge_coef > 1.0:
            center_x = x + w // 2
            center_y = y + h // 2
            new_w = int(w * enlarge_coef)
            new_h = int(h * enlarge_coef)
            x = max(0, center_x - new_w // 2)
            y = max(0, center_y - new_h // 2)
            w = min(new_w, frame.shape[1] - x)
            h = min(new_h, frame.shape[0] - y)
        
        return (x, y, w, h)


class SignalQualityChecker:
    """Check quality of extracted PPG signal (optional)."""
    
    @staticmethod
    def check_signal_quality(bvp: np.ndarray, fs: float) -> Dict:
        """
        Assess quality of PPG signal.
        
        Args:
            bvp: Blood volume pulse signal
            fs: Sampling frequency
            
        Returns:
            dict with quality metrics
        """
        # 1. SNR (Signal-to-Noise Ratio)
        snr = SignalQualityChecker._calculate_snr(bvp, fs)
        
        # 2. Check for flatline (no signal)
        is_flatline = np.std(bvp) < 0.01
        
        # 3. Check for clipping (saturation)
        is_clipped = (np.abs(bvp) > 10).any()
        
        # 4. Overall quality score (0-1)
        quality_score = min(1.0, snr / 10.0)  # SNR > 10 dB is good
        
        if is_flatline:
            quality_score = 0.0
        if is_clipped:
            quality_score *= 0.5
        
        return {
            'snr_db': snr,
            'is_flatline': is_flatline,
            'is_clipped': is_clipped,
            'quality_score': quality_score,
            'quality_level': SignalQualityChecker._get_quality_level(quality_score)
        }
    
    @staticmethod
    def _calculate_snr(bvp: np.ndarray, fs: float) -> float:
        """Calculate SNR in dB."""
        try:
            # FFT
            freqs = np.fft.rfftfreq(len(bvp), 1.0 / fs)
            fft_mag = np.abs(np.fft.rfft(bvp))
            power = fft_mag ** 2
            
            # Signal: power in HR range (0.75-3 Hz = 45-180 bpm)
            signal_band = (freqs >= 0.75) & (freqs <= 3.0)
            signal_power = np.sum(power[signal_band])
            
            # Noise: power outside HR range
            noise_band = ~signal_band
            noise_power = np.mean(power[noise_band])
            
            # SNR in dB
            snr_db = 10 * np.log10(signal_power / (noise_power + 1e-10))
            
            return float(snr_db)
        except:
            return 0.0
    
    @staticmethod
    def _get_quality_level(score: float) -> str:
        """Convert quality score to human-readable level."""
        if score >= 0.8:
            return "Excellent"
        elif score >= 0.6:
            return "Good"
        elif score >= 0.4:
            return "Fair"
        elif score >= 0.2:
            return "Poor"
        else:
            return "Very Poor"


class SimpleRPPGProcessor:
    """
    Simplified rPPG processor for production.
    Uses validated algorithms from rPPG-Toolbox.
    """
    
    def __init__(
        self,
        method: str = 'POS',
        target_fps: int = 30,
        use_video_fps: bool = False,
        chunk_length: int = 180,
        resize_dim: int = 128,
        use_mediapipe: bool = True,
        dynamic_detection_freq: int = 30,
        enlarge_box_coef: float = 1.5,
        check_quality: bool = False,
        max_face_detection_attempts: int = 5
    ):
        """
        Initialize processor.
        
        Args:
            method: rPPG method ('POS', 'CHROM', 'GREEN')
            target_fps: Target sampling rate (default: 30)
            use_video_fps: If True, use video's actual FPS instead of target_fps
            chunk_length: Frames per chunk (180 = 6 sec at 30fps)
            resize_dim: Resize face to this dimension (128x128)
            use_mediapipe: Use MediaPipe for face detection
            dynamic_detection_freq: Re-detect face every N frames (0 = only first frame)
            enlarge_box_coef: Enlarge face box by this factor
            check_quality: Whether to check signal quality
            max_face_detection_attempts: Try to detect face for this many frames before failing
        """
        self.method = method.upper()
        self.target_fps = target_fps
        self.use_video_fps = use_video_fps
        self.chunk_length = chunk_length
        self.resize_dim = resize_dim
        self.dynamic_detection_freq = dynamic_detection_freq
        self.enlarge_box_coef = enlarge_box_coef
        self.check_quality = check_quality
        self.max_face_detection_attempts = max_face_detection_attempts
        
        # Initialize face detector
        self.face_detector = FaceDetector(use_mediapipe=use_mediapipe)
        
        # Validate method
        if self.method not in ['POS', 'CHROM', 'GREEN']:
            raise ValueError(f"Unsupported method: {method}. Use: POS, CHROM, GREEN")
    
    def process_video(self, video_path: str, output_dir: Optional[str] = None) -> Dict:
        """
        Process video and extract heart rate.
        
        Args:
            video_path: Path to video file
            output_dir: Directory to save outputs (HR and BVP files)
            
        Returns:
            dict: {
                'success': bool,
                'heart_rate_bpm': float,
                'video_name': str,
                'video_duration_sec': float,
                'num_chunks': int,
                'fps_used': float,
                'method': str,
                'bvp_file': str (if output_dir provided),
                'hr_file': str (if output_dir provided),
                'quality': dict (if check_quality=True),
                'error': str or None
            }
        """
        try:
            video_name = os.path.splitext(os.path.basename(video_path))[0]
            
            print(f"\n{'='*60}")
            print(f"Processing: {video_name}")
            print(f"Method: {self.method}")
            print(f"{'='*60}\n")
            
            # 1. Load video and get properties
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return self._error_result(f"Could not open video: {video_path}")
            
            original_fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            
            # Determine FPS to use
            if self.use_video_fps:
                fps = original_fps
                print(f"✓ Using video's actual FPS: {fps:.2f}")
            else:
                fps = self.target_fps
                print(f"✓ Using default FPS: {fps} (video original: {original_fps:.2f})")
            
            print(f"✓ Video: {total_frames} frames")
            
            # 2. Process video frame-by-frame with face tracking
            print(f"\nStep 1/3: Loading video and detecting faces...")
            frames_processed, face_boxes = self._load_and_detect_faces(video_path)
            
            if len(frames_processed) == 0:
                return self._error_result(
                    f"No frames could be processed. Face detection failed after {self.max_face_detection_attempts} attempts."
                )
            
            print(f"✓ Processed: {len(frames_processed)} frames with faces detected")
            
            # 3. Split into chunks
            num_chunks = len(frames_processed) // self.chunk_length
            
            if num_chunks == 0:
                return self._error_result(
                    f"Video too short. Need at least {self.chunk_length} frames (~{self.chunk_length/fps:.1f} seconds at {fps} fps)."
                )
            
            print(f"✓ Split into {num_chunks} chunks of {self.chunk_length} frames each")
            
            # 4. Extract PPG signal from each chunk
            print(f"\nStep 2/3: Extracting PPG signals using {self.method} method...")
            
            all_bvps = []
            all_hrs = []
            
            # Process in batches to manage memory
            batch_size = 20
            
            with tqdm(total=num_chunks, desc="Processing chunks", unit="chunk") as pbar:
                for batch_start in range(0, num_chunks, batch_size):
                    batch_end = min(batch_start + batch_size, num_chunks)
                    
                    # Process this batch
                    for chunk_idx in range(batch_start, batch_end):
                        start_idx = chunk_idx * self.chunk_length
                        end_idx = start_idx + self.chunk_length
                        chunk_frames = frames_processed[start_idx:end_idx]
                        
                        # Extract BVP using selected method
                        bvp = self._extract_bvp(chunk_frames, fps)
                        
                        # Calculate HR from BVP
                        hr = self._calculate_hr(bvp, fps)
                        
                        all_bvps.append(bvp)
                        all_hrs.append(hr)
                        
                        pbar.update(1)
            
            # 5. Concatenate all BVP signals
            print(f"\nStep 3/3: Finalizing results...")
            full_bvp = np.concatenate(all_bvps)
            
            # 6. Calculate final HR (average across chunks)
            final_hr = float(np.mean(all_hrs))
            hr_std = float(np.std(all_hrs))
            
            print(f"\n{'='*60}")
            print(f"✓ Heart Rate: {final_hr:.2f} ± {hr_std:.2f} bpm")
            print(f"✓ Duration: {len(frames_processed)/fps:.1f} seconds")
            print(f"✓ BVP Signal Length: {len(full_bvp)} samples")
            
            # 7. Optional: Check signal quality
            quality_info = None
            if self.check_quality:
                quality_info = SignalQualityChecker.check_signal_quality(full_bvp, fps)
                print(f"✓ Signal Quality: {quality_info['quality_level']} (SNR: {quality_info['snr_db']:.1f} dB)")
            
            # 8. Save outputs
            bvp_file = None
            hr_file = None
            
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                
                # Save BVP signal
                bvp_file = os.path.join(output_dir, f"{video_name}_BVP.npy")
                np.save(bvp_file, full_bvp)
                print(f"✓ Saved BVP signal: {bvp_file}")
                
                # Save HR value
                hr_file = os.path.join(output_dir, f"{video_name}_HR.csv")
                hr_df = pd.DataFrame({
                    'heart_rate_bpm': [final_hr],
                    'hr_std_bpm': [hr_std],
                    'num_chunks': [num_chunks],
                    'fps_used': [fps],
                    'method': [self.method]
                })
                hr_df.to_csv(hr_file, index=False)
                print(f"✓ Saved HR value: {hr_file}")
            
            print(f"{'='*60}\n")
            
            # 9. Return results
            result = {
                'success': True,
                'heart_rate_bpm': round(final_hr, 2),
                'hr_std_bpm': round(hr_std, 2),
                'video_name': video_name,
                'video_duration_sec': len(frames_processed) / fps,
                'num_chunks': num_chunks,
                'fps_used': fps,
                'method': self.method,
                'bvp_signal_length': len(full_bvp),
                'bvp_signal': full_bvp,
                'error': None
            }
            
            if bvp_file:
                result['bvp_file'] = bvp_file
            if hr_file:
                result['hr_file'] = hr_file
            
            if quality_info:
                result['quality'] = quality_info
            
            return result
            
        except Exception as e:
            import traceback
            print("\n" + "="*60)
            print("ERROR OCCURRED:")
            print("="*60)
            traceback.print_exc()
            print("="*60 + "\n")
            return self._error_result(f"Processing failed: {str(e)}")
    
    def _load_and_detect_faces(self, video_path: str) -> Tuple[np.ndarray, List]:
        """
        Load video and detect faces with dynamic re-detection.
        Tries for max_face_detection_attempts frames before failing.
        
        Returns:
            (processed_frames, face_boxes)
        """
        cap = cv2.VideoCapture(video_path)
        
        processed_frames = []
        face_boxes = []
        current_face_box = None
        frame_count = 0
        frames_without_face = 0
        
        # Progress bar for loading
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        pbar = tqdm(total=total_frames, desc="Loading & detecting faces", unit="frame")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Detect face on first frame or periodically
            should_detect = (
                current_face_box is None or 
                (self.dynamic_detection_freq > 0 and frame_count % self.dynamic_detection_freq == 0)
            )
            
            if should_detect:
                detected_box = self.face_detector.detect(frame_rgb, self.enlarge_box_coef)
                
                if detected_box is not None:
                    current_face_box = detected_box
                    frames_without_face = 0
                elif current_face_box is None:
                    # No face detected yet
                    frames_without_face += 1
                    
                    # Give up after max attempts
                    if frames_without_face >= self.max_face_detection_attempts:
                        pbar.close()
                        cap.release()
                        print(f"\n✗ Failed to detect face in first {self.max_face_detection_attempts} frames")
                        return np.array([]), []
                    
                    frame_count += 1
                    pbar.update(1)
                    continue
            
            # Crop and resize face
            x, y, w, h = current_face_box
            
            # Ensure coordinates are within bounds
            x = max(0, x)
            y = max(0, y)
            w = min(w, frame_rgb.shape[1] - x)
            h = min(h, frame_rgb.shape[0] - y)
            
            face_crop = frame_rgb[y:y+h, x:x+w]
            
            if face_crop.size == 0:
                # Invalid crop, skip frame
                frame_count += 1
                pbar.update(1)
                continue
            
            face_resized = cv2.resize(face_crop, (self.resize_dim, self.resize_dim), interpolation=cv2.INTER_AREA)
            
            processed_frames.append(face_resized)
            face_boxes.append(current_face_box)
            frame_count += 1
            pbar.update(1)
        
        pbar.close()
        cap.release()
        
        return np.array(processed_frames), face_boxes
    
    def _extract_bvp(self, frames: np.ndarray, fs: float) -> np.ndarray:
        """
        Extract BVP signal using selected method.
        Uses validated implementations from rPPG-Toolbox.
        """
        if self.method == 'POS':
            return POS_WANG(frames, fs)
        elif self.method == 'CHROM':
            return CHROME_DEHAAN(frames, fs)
        elif self.method == 'GREEN':
            return GREEN(frames)
        else:
            raise ValueError(f"Unsupported method: {self.method}")
    
    def _calculate_hr(self, bvp: np.ndarray, fs: float) -> float:
        """Calculate heart rate from BVP using FFT."""
        # FFT
        freqs = np.fft.rfftfreq(len(bvp), 1.0 / fs)
        fft_mag = np.abs(np.fft.rfft(bvp))
        
        # Filter to physiological range (40-180 bpm = 0.67-3 Hz)
        valid_idx = (freqs >= 0.67) & (freqs <= 3.0)
        valid_freqs = freqs[valid_idx]
        valid_mag = fft_mag[valid_idx]
        
        if len(valid_freqs) == 0:
            return 75.0  # Default fallback
        
        # Find peak frequency
        peak_idx = np.argmax(valid_mag)
        hr_hz = valid_freqs[peak_idx]
        hr_bpm = hr_hz * 60.0
        
        return hr_bpm
    
    def _error_result(self, error_msg: str) -> Dict:
        """Return error result."""
        return {
            'success': False,
            'heart_rate_bpm': None,
            'video_name': None,
            'video_duration_sec': 0.0,
            'num_chunks': 0,
            'fps_used': 0.0,
            'method': self.method,
            'error': error_msg
        }


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Simple rPPG Processor - Extract heart rate from video',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python simple_rppg_processor.py --video video.mp4
  python simple_rppg_processor.py --video video.mp4 --method CHROM
  python simple_rppg_processor.py --video video.mp4 --output outputs --check-quality
  python simple_rppg_processor.py --video video.mp4 --use-video-fps
        """
    )
    
    # Required arguments
    parser.add_argument('--video', type=str, required=True,
                        help='Path to input video file')
    
    # Optional arguments
    parser.add_argument('--method', type=str, default='POS',
                        choices=['POS', 'CHROM', 'GREEN'],
                        help='rPPG method to use (default: POS)')
    
    parser.add_argument('--output', type=str, default=None,
                        help='Output directory to save HR and BVP files')
    
    parser.add_argument('--fps', type=int, default=30,
                        help='Target FPS for processing (default: 30)')
    
    parser.add_argument('--use-video-fps', action='store_true',
                        help='Use video\'s actual FPS instead of target FPS')
    
    parser.add_argument('--check-quality', action='store_true',
                        help='Check and report signal quality metrics')
    
    parser.add_argument('--no-mediapipe', action='store_true',
                        help='Use Haar Cascade instead of MediaPipe for face detection')
    
    args = parser.parse_args()
    
    # Create processor
    processor = SimpleRPPGProcessor(
        method=args.method,
        target_fps=args.fps,
        use_video_fps=args.use_video_fps,
        use_mediapipe=not args.no_mediapipe,
        dynamic_detection_freq=30,
        check_quality=args.check_quality
    )
    
    # Process video
    result = processor.process_video(args.video, output_dir=args.output)
    
    # Exit with appropriate code
    if result['success']:
        exit(0)
    else:
        exit(1)


if __name__ == "__main__":
    main()