import { useState, useRef } from 'react';
import { Camera, Upload, Link as LinkIcon, Activity, Heart, ShieldCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';
import RealTimeAnalyzer from '../components/RealTimeAnalyzer';

// Default API URL
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const RENDER_API_URL = 'https://rppg-new.onrender.com';

export default function Index() {
  const [currentApiUrl, setCurrentApiUrl] = useState(DEFAULT_API_URL);
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'realtime'>('upload');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${currentApiUrl}/analyze`, formData);
      setResult(response.data);
    } catch (err: any) {
      console.error("Erro ao analisar vídeo:", err);
      setError(err.response?.data?.detail || "Falha na conexão com o servidor de análise.");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await axios.post(`${currentApiUrl}/analyze-url`, { url });
      setResult(response.data);
    } catch (err: any) {
      console.error("Erro ao analisar URL:", err);
      setError(err.response?.data?.detail || "Falha na análise da URL.");
    } finally {
      setLoading(false);
    }
  };

  const handleRealTimeResult = (data: any) => {
    setResult(data);
  };

  return (
    <div className="container min-h-screen flex flex-col">
      <header className="py-8 text-center">
        <h1 className="text-4xl font-bold text-gradient mb-2">rPPG Analyzer</h1>
        <p className="text-text-secondary">Análise de sinais vitais via vídeo facial</p>
        
        <div className="mt-4 flex justify-center gap-4">
          <button 
            onClick={() => setCurrentApiUrl(DEFAULT_API_URL)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${currentApiUrl === DEFAULT_API_URL ? 'bg-accent-primary text-black' : 'bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10'}`}
          >
            Backend Local
          </button>
          <button 
            onClick={() => setCurrentApiUrl(RENDER_API_URL)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${currentApiUrl === RENDER_API_URL ? 'bg-accent-primary text-black' : 'bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10'}`}
          >
            Backend Render (Teste)
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full">
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => { setActiveTab('upload'); setResult(null); setError(null); }}
          >
            <Upload size={18} className="inline mr-2" /> Upload
          </button>
          <button 
            className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => { setActiveTab('url'); setResult(null); setError(null); }}
          >
            <LinkIcon size={18} className="inline mr-2" /> URL
          </button>
          <button 
            className={`tab-btn ${activeTab === 'realtime' ? 'active' : ''}`}
            onClick={() => { setActiveTab('realtime'); setResult(null); setError(null); }}
          >
            <Camera size={18} className="inline mr-2" /> Real-time
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Erro na análise</p>
              <p className="text-sm opacity-90">{error}</p>
              <p className="text-xs mt-1 italic">Certifique-se de que o backend está rodando em: {currentApiUrl}</p>
            </div>
          </div>
        )}

        <div className="card mb-8">
          {activeTab === 'upload' && (
            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                 onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="video/*" />
              <Upload size={48} className="mx-auto mb-4 text-accent-primary" />
              <p className="text-lg font-medium">Clique ou arraste um vídeo facial</p>
              <p className="text-sm text-text-secondary mt-2">Formatos suportados: MP4, MOV, AVI</p>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-4 py-8">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="https://exemplo.com/video.mp4"
                  className="flex-1 bg-bg-primary border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-accent-primary text-white"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleUrlSubmit} disabled={loading}>
                  Analisar
                </button>
              </div>
              <p className="text-xs text-text-secondary text-center italic">
                O servidor fará o download e processará o vídeo remotamente.
              </p>
            </div>
          )}

          {activeTab === 'realtime' && (
            <div className="py-4">
              <RealTimeAnalyzer onResult={handleRealTimeResult} apiUrl={currentApiUrl} />
            </div>
          )}
        </div>

        {loading && (
          <div className="card text-center py-8">
            <Activity className="mx-auto mb-4 animate-pulse text-accent-primary" size={32} />
            <p>Processando vídeo... Isso pode levar alguns segundos.</p>
          </div>
        )}

        {result && result.success && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card flex items-center gap-6">
              <div className="p-4 bg-red-500/10 rounded-full">
                <Heart size={48} className={`text-red-500 ${result.heart_rate_bpm ? 'animate-bounce' : 'opacity-20'}`} />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Frequência Cardíaca</p>
                <h2 className="text-5xl font-bold">
                  {result.heart_rate_bpm || '--'} 
                  <span className="text-xl font-normal text-text-secondary ml-2">BPM</span>
                </h2>
              </div>
            </div>

            <div className="card flex items-center gap-6">
              <div className="p-4 bg-green-500/10 rounded-full">
                <ShieldCheck size={48} className="text-green-500" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Qualidade do Sinal</p>
                <h2 className="text-3xl font-bold">{result.quality?.quality_level || 'Normal'}</h2>
                <p className="text-xs text-text-secondary">SNR: {result.quality?.snr_db?.toFixed(1) || '0.0'} dB</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-text-secondary text-sm">
        <p>© 2024 rPPG Analyzer - Tecnologia de monitoramento não invasivo</p>
      </footer>
    </div>
  );
}
