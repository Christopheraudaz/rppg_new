import { useState } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { WebcamAnalyzer } from './components/WebcamAnalyzer';
import { Heart, Upload, Camera } from 'lucide-react';

function App() {
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'realtime'>('upload');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-bg-secondary/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Heart className="text-white fill-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">rPPG <span className="text-gradient">Analyzer</span></h1>
              <p className="text-xs text-text-secondary">Remote Photoplethysmography</p>
            </div>
          </div>
          <div className="text-sm text-text-secondary">
            v1.1.0
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12 flex flex-col items-center">
        {!results ? (
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4">
                Measure Heart Rate <span className="text-gradient">Contactless</span>
              </h2>
              <p className="text-text-secondary text-lg max-w-lg mx-auto">
                Advanced computer vision algorithms to extract vital signals from facial videos or live camera.
              </p>
            </div>

            <div className="max-w-xs mx-auto tabs-container">
              <button 
                className={`tab-btn flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={16} />
                Upload
              </button>
              <button 
                className={`tab-btn flex items-center justify-center gap-2 ${activeTab === 'realtime' ? 'active' : ''}`}
                onClick={() => setActiveTab('realtime')}
              >
                <Camera size={16} />
                Real-time
              </button>
            </div>

            {activeTab === 'upload' ? (
              <VideoUpload onResult={setResults} />
            ) : (
              <WebcamAnalyzer />
            )}

            {activeTab === 'upload' && (
              <div className="mt-12 grid grid-cols-3 gap-8 text-center text-sm text-text-secondary">
                <div>
                  <div className="font-semibold text-white mb-1">Contactless</div>
                  No wearables needed
                </div>
                <div>
                  <div className="font-semibold text-white mb-1">Fast Processing</div>
                  Results in seconds
                </div>
                <div>
                  <div className="font-semibold text-white mb-1">Privacy First</div>
                  No data stored
                </div>
              </div>
            )}
          </div>
        ) : (
          <ResultsDisplay data={results} onReset={() => setResults(null)} />
        )}
      </main>
    </div>
  );
}

export default App;
