import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Loader2, Heart, Activity, AlertCircle } from 'lucide-react';

interface WebcamAnalyzerProps {
    onBack?: () => void;
}

export const WebcamAnalyzer: React.FC<WebcamAnalyzerProps> = () => {
    const [isActive, setIsActive] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any>(null);
    const [bufferProgress, setBufferProgress] = useState(0);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const lastFrameTime = useRef<number>(0);

    const stopCamera = useCallback(() => {
        setIsActive(false);
        setConnecting(false);
        setResults(null);
        setBufferProgress(0);
        
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
        
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const captureFrame = useCallback(() => {
        if (!isActive || !videoRef.current || !canvasRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const now = performance.now();
        // Limit to ~30 FPS
        if (now - lastFrameTime.current < 33) {
            requestRef.current = requestAnimationFrame(captureFrame);
            return;
        }
        lastFrameTime.current = now;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Get base64 data
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Send to WebSocket
            wsRef.current.send(dataUrl);
        }

        requestRef.current = requestAnimationFrame(captureFrame);
    }, [isActive]);

    useEffect(() => {
        if (isActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isActive]);

    const startCamera = async () => {
        setError(null);
        setConnecting(true);
        
        try {
            // 1. Get Camera Stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                } 
            });
            
            streamRef.current = stream;

            // 2. Connect WebSocket
            const ws = new WebSocket('ws://127.0.0.1:8000/ws/analyze');
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket Connected');
                setIsActive(true);
                setConnecting(false);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.success) {
                        setResults(data);
                        setBufferProgress(data.buffer_fullness || 1);
                    } else if (data.error) {
                        setError(data.error);
                    }
                } catch (e) {
                    console.error('Error parsing WS message:', e);
                }
            };

            ws.onerror = (e) => {
                console.error('WebSocket Error:', e);
                setError('WebSocket connection error.');
                stopCamera();
            };

            ws.onclose = (e) => {
                console.log('WebSocket Closed:', e.code, e.reason);
                if (isActive) stopCamera();
                else setConnecting(false);
            };

        } catch (err: any) {
            console.error('Camera Access Error:', err);
            setError(err.name === 'NotAllowedError' 
                ? 'Camera access denied. Please allow camera permissions.' 
                : 'Could not access camera or backend.');
            setConnecting(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            requestRef.current = requestAnimationFrame(captureFrame);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isActive, captureFrame]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                
                {/* Camera View */}
                <div className="relative aspect-video bg-bg-card rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    {!isActive ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <Camera className="text-text-secondary" size={40} />
                            </div>
                            <h3 className="text-xl font-semibold mb-4">Real-time HR Monitoring</h3>
                            <p className="text-text-secondary mb-8 max-w-sm">
                                Use your camera to measure heart rate in real-time. Make sure your face is well-lit and centered.
                            </p>
                            <button 
                                onClick={startCamera}
                                disabled={connecting}
                                className="btn btn-primary px-8"
                            >
                                {connecting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Camera size={20} />
                                        Start Camera
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <>
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="w-full h-full object-cover mirror"
                            />
                            {/* Hidden canvas for frame capture */}
                            <canvas 
                                ref={canvasRef} 
                                width={320} 
                                height={240} 
                                className="hidden" 
                            />
                            
                            {/* Overlay UI */}
                            <div className="absolute top-4 right-4 animate-in fade-in duration-500">
                                <button 
                                    onClick={stopCamera}
                                    className="p-2 bg-black/50 hover:bg-red-500/50 backdrop-blur-md rounded-full text-white transition-colors"
                                    title="Stop Camera"
                                >
                                    <CameraOff size={20} />
                                </button>
                            </div>

                            {bufferProgress < 1 && isActive && (
                                <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-medium text-white/80">Analyzing facial signals...</span>
                                        <span className="text-xs text-white/60">{Math.round(bufferProgress * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-accent-primary transition-all duration-500 ease-out"
                                            style={{ width: `${bufferProgress * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="absolute bottom-4 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-md rounded-xl flex items-center gap-3 text-white border border-red-400/20 animate-in slide-in-from-bottom-2">
                            <AlertCircle size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}
                </div>

                {/* Real-time Results */}
                <div className="flex flex-col gap-6">
                    <div className="card h-full flex flex-col justify-center items-center p-8 bg-gradient-to-br from-bg-card to-bg-secondary border-white/5">
                        {results ? (
                            <div className="text-center animate-in zoom-in duration-500">
                                <div className="flex items-center justify-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
                                        <Heart size={36} fill="currentColor" />
                                    </div>
                                    <div className="text-left">
                                        <span className="text-sm text-text-secondary uppercase tracking-wider font-semibold">Live Heart Rate</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-6xl font-black text-white">{Math.round(results.heart_rate_bpm)}</span>
                                            <span className="text-xl text-text-secondary font-bold">BPM</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex items-center gap-6 justify-center">
                                    <div className="text-center">
                                        <p className="text-xs text-text-secondary uppercase mb-1">Quality</p>
                                        <span className={`text-sm font-bold ${
                                            results.quality.quality_level === 'Excellent' || results.quality.quality_level === 'Good' 
                                            ? 'text-green-400' : 'text-yellow-400'
                                        }`}>
                                            {results.quality.quality_level}
                                        </span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10" />
                                    <div className="text-center">
                                        <p className="text-xs text-text-secondary uppercase mb-1">SNR</p>
                                        <span className="text-sm font-bold text-white">
                                            {results.quality.snr_db.toFixed(1)} dB
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-10 w-full h-24 bg-white/5 rounded-xl border border-white/5 flex items-end justify-center p-2 gap-1 overflow-hidden">
                                     {results.bvp_latest.map((val: number, i: number) => (
                                         <div 
                                            key={i}
                                            className="w-full bg-accent-primary/60 rounded-t-sm"
                                            style={{ 
                                                height: `${Math.min(100, Math.max(10, (val + 1) * 50))}%`,
                                                opacity: (i + 1) / results.bvp_latest.length
                                            }}
                                         />
                                     ))}
                                </div>
                                <p className="text-[10px] text-text-secondary mt-2 flex items-center justify-center gap-1">
                                    <Activity size={10} /> LIVE BVP SIGNAL
                                </p>
                            </div>
                        ) : (
                            <div className="text-center text-text-secondary opacity-50">
                                <Heart className="mx-auto mb-4" size={48} />
                                <p>Waiting for data...</p>
                            </div>
                        )}
                    </div>

                    <div className="card p-6 bg-white/5 border-white/5">
                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Activity className="text-accent-primary" size={16} /> 
                            How it works
                        </h4>
                        <ul className="text-xs text-text-secondary space-y-3">
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                Camera captures subtle color changes in your skin caused by blood flow.
                            </li>
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                MediaPipe identifies and tracks your face to isolate region of interest.
                            </li>
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                                Advanced signal processing filters noise and extracts the heart rate signal.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
