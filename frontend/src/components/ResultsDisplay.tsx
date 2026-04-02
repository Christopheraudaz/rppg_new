import React, { useEffect, useRef } from 'react';
import { Activity, Clock, BarChart2, CheckCircle } from 'lucide-react';

interface ResultsDisplayProps {
    data: any;
    onReset: () => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ data, onReset }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw signal
    useEffect(() => {
        if (data.bvp_signal && Array.isArray(data.bvp_signal) && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const signal = data.bvp_signal;
            const width = canvas.width;
            const height = canvas.height;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Normalize signal to fit canvas height
            const min = Math.min(...signal);
            const max = Math.max(...signal);
            const range = max - min;

            if (range === 0) return;

            ctx.beginPath();
            ctx.strokeStyle = '#38bdf8'; // accent-primary
            ctx.lineWidth = 2;

            const step = width / (signal.length - 1);

            signal.forEach((val: number, index: number) => {
                const x = index * step;
                // Invert y because canvas 0 is top
                const normalizedVal = (val - min) / range;
                const y = height - (normalizedVal * height * 0.8 + height * 0.1); // Keep 10% padding

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        }
    }, [data]);

    const getQualityColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'excellent': return 'text-green-400 bg-green-400/10';
            case 'good': return 'text-blue-400 bg-blue-400/10';
            case 'fair': return 'text-yellow-400 bg-yellow-400/10';
            case 'poor':
            case 'very poor': return 'text-red-400 bg-red-400/10';
            default: return 'text-gray-400 bg-gray-400/10';
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Heart Rate Card */}
                <div className="card flex flex-col items-center justify-center p-8 md:col-span-1 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <Activity className="animate-pulse" />
                            <span className="font-medium uppercase tracking-wider text-sm">Heart Rate</span>
                        </div>
                        <div className="text-5xl font-bold text-white mb-1">
                            {Math.round(data.heart_rate_bpm)}
                            <span className="text-2xl text-text-secondary ml-1 font-normal">BPM</span>
                        </div>
                        {data.hr_std_bpm && (
                            <div className="text-sm text-text-secondary">
                                ± {data.hr_std_bpm.toFixed(1)} bpm
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="card p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-accent-primary mb-2">
                            <BarChart2 size={20} />
                            <span className="font-medium text-sm">Signal Quality</span>
                        </div>
                        <div className={`text-2xl font-bold inline-flex items-center gap-2 ${data.quality ? getQualityColor(data.quality.quality_level) : ''}`}>
                            {data.quality ? (
                                <>
                                    {data.quality.quality_level}
                                    <span className="text-sm font-normal opacity-70">({data.quality.snr_db.toFixed(1)} dB)</span>
                                </>
                            ) : 'N/A'}
                        </div>
                    </div>

                    <div className="card p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-accent-secondary mb-2">
                            <Clock size={20} />
                            <span className="font-medium text-sm">Duration</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {data.video_duration_sec.toFixed(1)}s
                        </div>
                        <div className="text-sm text-text-secondary">
                            {data.num_chunks} chunks processed
                        </div>
                    </div>

                    <div className="card p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-purple-400 mb-2">
                            <CheckCircle size={20} />
                            <span className="font-medium text-sm">Method</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {data.method}
                        </div>
                    </div>

                    <div className="card p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-orange-400 mb-2">
                            <Activity size={20} />
                            <span className="font-medium text-sm">FPS Used</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {data.fps_used.toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* Signal Graph */}
                {data.bvp_signal && (
                    <div className="md:col-span-3 card p-6">
                        <div className="flex items-center gap-2 text-accent-primary mb-4">
                            <Activity size={20} />
                            <span className="font-medium text-sm">PPG Signal (BVP)</span>
                        </div>
                        <div className="w-full h-48 bg-bg-primary/50 rounded-lg overflow-hidden relative">
                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={192}
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-center mt-8">
                <button onClick={onReset} className="btn bg-bg-card hover:bg-bg-secondary text-white border border-white/10">
                    Analyze Another Video
                </button>
            </div>
        </div>
    );
};
