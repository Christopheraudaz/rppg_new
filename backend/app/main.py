import asyncio
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import tempfile
from pathlib import Path
import numpy as np
import requests
from pydantic import BaseModel
from .rppg_engine.simple_rppg_processor import SimpleRPPGProcessor
from .rppg_engine.realtime_processor import RealTimeRPPGProcessor

app = FastAPI(title="rPPG Web API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_numpy_types(obj):
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (np.integer, int)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(i) for i in obj]
    else:
        return obj

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)):
    # Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_video:
        try:
            # Save uploaded file
            shutil.copyfileobj(file.file, temp_video)
            temp_path = temp_video.name
            temp_video.close() # Close file handle so processor can open it
            
            print(f"Processing video: {temp_path}")
            
            # Initialize processor
            # We use default settings: POS method, 30 fps target
            processor = SimpleRPPGProcessor(
                method='POS',
                check_quality=True,
                use_mediapipe=True
            )
            
            # Process
            result = processor.process_video(temp_path)
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result.get('error', 'Unknown error'))
            
            # Clean up result for JSON response
            if 'bvp_file' in result:
                del result['bvp_file']
            if 'hr_file' in result:
                del result['hr_file']
                
            # Convert numpy types to native python types
            clean_result = convert_numpy_types(result)
            
            return clean_result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            # Cleanup temp file
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection established")
    
    # Initialize real-time processor for this session
    analyzer = RealTimeRPPGProcessor(
        method='POS',
        window_seconds=6,
        target_fps=30,
        update_interval_frames=30,
        use_mediapipe=True
    )
    
    try:
        while True:
            # Receive data from client
            data = await websocket.receive_text()
            
            # Process the frame
            result = analyzer.process_frame(data)
            
            # If an update is available (HR calculated), send it back
            if result:
                print(f"Sending real-time update: {result.get('heart_rate_bpm')} BPM")
                clean_result = convert_numpy_types(result)
                await websocket.send_json(clean_result)
            
            # Keep log of frames to see if they are arriving
            if analyzer.frame_count % 30 == 0:
                print(f"Frames processed: {analyzer.frame_count} (Buffer: {len(analyzer.frame_buffer)})")
                
    except WebSocketDisconnect:
        print("WebSocket connection closed by client")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()

class VideoURL(BaseModel):
    url: str

@app.post("/analyze-url")
async def analyze_video_url(video: VideoURL):
    # Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
        try:
            print(f"Downloading video from: {video.url}")
            response = requests.get(video.url, stream=True)
            response.raise_for_status()
            
            for chunk in response.iter_content(chunk_size=8192):
                temp_video.write(chunk)
                
            temp_path = temp_video.name
            temp_video.close()
            
            print(f"Processing video: {temp_path}")
            
            # Initialize processor
            processor = SimpleRPPGProcessor(
                method='POS',
                check_quality=True,
                use_mediapipe=True
            )
            
            # Process
            result = processor.process_video(temp_path)
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result.get('error', 'Unknown error'))
            
            # Clean up result
            if 'bvp_file' in result: del result['bvp_file']
            if 'hr_file' in result: del result['hr_file']
                
            return convert_numpy_types(result)
            
        except requests.RequestException as e:
            raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
