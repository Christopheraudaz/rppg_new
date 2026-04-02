import { useEffect, useRef, useState } from 'react';
import { Camera, Activity, AlertCircle } from 'lucide-react';

interface RealTimeAnalyzerProps {
  onResult: (data: any) => void;
  apiUrl: string;
}

export default function RealTimeAnalyzer({ onResult, apiUrl }: RealTimeAnalyzerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Derive WebSocket URL from API URL
  const getWsUrl = () => {
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${host}/ws/analyze`;
  };

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        connectWebSocket();
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      console.error(err);
    }
  };

  const connectWebSocket = () => {
    const wsUrl = getWsUrl();
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onResult(data);
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    socketRef.current.onerror = () => {
      setError("Erro na conexão com o servidor de análise. Verifique se o backend está rodando.");
    };
    
    socketRef.current.onclose = () => {
      if (isStreaming) setIsStreaming(false);
    };
  };

  useEffect(() => {
    if (isStreaming) {
      const sendFrame = (timestamp: number) => {
        // Throttle to 15 FPS (approx 66ms between frames)
        if (timestamp - lastFrameTimeRef.current >= 66) {
          if (socketRef.current?.readyState === WebSocket.OPEN && canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
              // Draw small frame for performance
              context.drawImage(videoRef.current, 0, 0, 320, 240);
              const base64Frame = canvasRef.current.toDataURL('image/jpeg', 0.5);
              socketRef.current.send(base64Frame);
              lastFrameTimeRef.current = timestamp;
            }
          }
        }
        requestRef.current = requestAnimationFrame(sendFrame);
      };
      requestRef.current = requestAnimationFrame(sendFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isStreaming]);

  const stopStream = () => {
    setIsStreaming(false);
    if (socketRef.current) socketRef.current.close();
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg flex items-center gap-2 mb-4">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full max-w-md border border-white/10">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
        <canvas ref={canvasRef} width="320" height="240" className="hidden" />
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <Camera size={48} className="text-white/20" />
          </div>
        )}
      </div>

      <button 
        onClick={isStreaming ? stopStream : startStream}
        className={`btn ${isStreaming ? 'bg-red-500 hover:bg-red-600' : 'btn-primary'}`}
      >
        {isStreaming ? 'Parar Captura' : 'Iniciar Captura'}
      </button>

      {isStreaming && (
        <div className="flex items-center gap-2 text-accent-primary animate-pulse">
          <Activity size={18} /> Analisando fluxo de vídeo (15 FPS)...
        </div>
      )}
    </div>
  );
}
