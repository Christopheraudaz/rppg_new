import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileVideo, Loader2, AlertCircle } from 'lucide-react';

interface VideoUploadProps {
    onResult: (data: any) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onResult }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (selectedFile: File) => {
        if (!selectedFile.type.startsWith('video/')) {
            setError('Please upload a valid video file.');
            return;
        }
        setFile(selectedFile);
        setError(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Assuming backend is running on localhost:8000
            const response = await axios.post('http://localhost:8000/analyze', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onResult(response.data);
        } catch (err: any) {
            console.error(err);
            if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
                setError('Backend server is not reachable. Please ensure the Python backend is running on port 8000.');
            } else {
                setError(err.response?.data?.detail || 'Failed to process video. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <div
                className={`card relative border-2 border-dashed transition-all duration-300 ${isDragging
                        ? 'border-accent-primary bg-bg-card/50'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="video/*"
                    onChange={handleFileSelect}
                />

                <div className="flex flex-col items-center justify-center py-12 text-center">
                    {file ? (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 rounded-full bg-accent-primary/20 flex items-center justify-center mb-4 text-accent-primary">
                                <FileVideo size={32} />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{file.name}</h3>
                            <p className="text-text-secondary mb-6">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setFile(null)}
                                    className="px-4 py-2 rounded-lg text-text-secondary hover:text-white transition-colors"
                                    disabled={loading}
                                >
                                    Change File
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={loading}
                                    className="btn btn-primary min-w-[140px]"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Start Analysis
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4 text-gray-400">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Upload Video</h3>
                            <p className="text-text-secondary mb-6 max-w-xs">
                                Drag and drop your video file here, or click to browse
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn bg-gray-700 hover:bg-gray-600 text-white"
                            >
                                Select Video
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="absolute bottom-4 left-4 right-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 animate-in slide-in-from-bottom-2">
                        <AlertCircle size={20} />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
            </div>

            {loading && (
                <div className="mt-6 text-center text-text-secondary animate-pulse">
                    <p>Analyzing heart rate signals...</p>
                    <p className="text-sm opacity-70">This may take a minute depending on video length</p>
                </div>
            )}
        </div>
    );
};
