import React, { useState, useRef } from 'react';
import { 
  Upload, Video, Image as ImageIcon, X, Play, Check, 
  AlertCircle, RefreshCw, Link as LinkIcon, Film, Eye, Sparkles, Loader2
} from 'lucide-react';
import { getSessionToken } from '../lib/api';

interface MediaUploadZoneProps {
  label: string;
  subLabel?: string;
  acceptType?: 'all' | 'video' | 'image';
  currentUrl: string;
  mediaType?: 'image' | 'video';
  onMediaChanged: (url: string, detectedType?: 'image' | 'video', fileName?: string) => void;
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
  required?: boolean;
}

export default function MediaUploadZone({
  label,
  subLabel,
  acceptType = 'all',
  currentUrl,
  mediaType,
  onMediaChanged,
  onShowToast,
  required = false,
}: MediaUploadZoneProps) {
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerToast = (msg: string, type: 'success' | 'error') => {
    if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  // Determine accept string for file picker
  let acceptAttr = 'image/*,video/*,.mp4,.webm,.mov,.mkv,.avi,.ogg,.m4v,.ts,.m3u8,.flv,.wmv,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif';
  if (acceptType === 'video') {
    acceptAttr = 'video/*,.mp4,.webm,.mov,.mkv,.avi,.ogg,.m4v,.ts,.m3u8,.flv,.wmv,.3gp';
  } else if (acceptType === 'image') {
    acceptAttr = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif';
  }

  // Detect file type from URL or extension
  const isVideoUrl = (url: string) => {
    if (mediaType === 'video' || acceptType === 'video') return true;
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.mp4') || 
      lower.endsWith('.webm') || 
      lower.endsWith('.mov') || 
      lower.endsWith('.mkv') || 
      lower.endsWith('.ogg') || 
      lower.endsWith('.m4v') ||
      lower.endsWith('.ts') ||
      lower.endsWith('.m3u8') ||
      lower.endsWith('.avi') ||
      lower.endsWith('.flv') ||
      lower.endsWith('.wmv') ||
      lower.includes('video') ||
      lower.includes('.mp4?') ||
      lower.includes('.webm?')
    );
  };

  const handleFile = async (file: File) => {
    if (!file) return;

    setUploadError(null);

    // File validation: Support up to 250MB (comfortably allowing 200MB videos)
    const maxSizeBytes = 250 * 1024 * 1024; // 250MB
    if (file.size > maxSizeBytes) {
      const err = `File size is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed limit is 250MB.`;
      setUploadError(err);
      triggerToast(err, 'error');
      return;
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|ogg|m4v|ts|m3u8|flv|wmv|3gp)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(file.name);

    if (acceptType === 'video' && !isVideo) {
      const err = 'Please upload a valid video file (MP4, WebM, MOV, MKV, AVI, etc.)';
      setUploadError(err);
      triggerToast(err, 'error');
      return;
    }
    if (acceptType === 'image' && !isImage) {
      const err = 'Please upload a valid image file (JPG, PNG, WebP, GIF, SVG)';
      setUploadError(err);
      triggerToast(err, 'error');
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadProgress(`Starting upload for ${file.name} (${fileSizeMB} MB)...`);
    setPreviewError(false);

    try {
      // Collect session authorization token
      const token = getSessionToken() || 
                    localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cinode_auth_token') || 
                    sessionStorage.getItem('cinode_auth_token') || 
                    localStorage.getItem('token') || 
                    '';

      // 1.5MB chunk size guarantees passing all hosting upload_max_filesize and post_max_size limits
      const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5MB per slice
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      let finalResult: { url: string; mediaType?: string; fileName?: string } | null = null;

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunkBlob, file.name);
        formData.append('file', chunkBlob, file.name); // Compatibility alias
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIdx.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('fileType', file.type);
        if (token) {
          formData.append('token', token);
        }

        const chunkResult = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const uploadEndpoint = `/api/admin/landing/upload${token ? `?token=${encodeURIComponent(token)}` : ''}`;
          xhr.open('POST', uploadEndpoint, true);
          xhr.withCredentials = true;

          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const currentTotalLoaded = start + e.loaded;
              const overallPercent = Math.min(99, Math.round((currentTotalLoaded / file.size) * 100));
              const loadedMB = (currentTotalLoaded / (1024 * 1024)).toFixed(1);
              const totalMB = (file.size / (1024 * 1024)).toFixed(1);
              setUploadPercent(overallPercent);
              if (totalChunks > 1) {
                setUploadProgress(`Uploading chunk ${chunkIdx + 1}/${totalChunks} (${loadedMB} MB / ${totalMB} MB - ${overallPercent}%)...`);
              } else {
                setUploadProgress(`Uploading (${loadedMB} MB / ${totalMB} MB - ${overallPercent}%)...`);
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                resolve(resJson);
              } catch (err) {
                reject(new Error('Failed to parse server upload response.'));
              }
            } else {
              let errorMsg = `Upload failed with HTTP ${xhr.status}`;
              try {
                const resJson = JSON.parse(xhr.responseText);
                if (resJson && resJson.error) {
                  errorMsg = resJson.error;
                }
              } catch {
                if (xhr.responseText && xhr.responseText.length < 200) {
                  errorMsg = xhr.responseText;
                }
              }
              reject(new Error(errorMsg));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Network connection interrupted during file chunk upload. Please retry.'));
          };

          xhr.ontimeout = () => {
            reject(new Error('Chunk upload timed out. Retrying recommended.'));
          };

          xhr.send(formData);
        });

        if (chunkIdx === totalChunks - 1) {
          finalResult = chunkResult;
        }
      }

      setUploadPercent(100);
      setUploadProgress('Finalizing and indexing media file...');

      if (!finalResult || !finalResult.url) {
        throw new Error('Server did not return a valid media URL upon completion.');
      }

      const detectedType: 'image' | 'video' = finalResult.mediaType === 'video' || isVideo ? 'video' : 'image';
      onMediaChanged(finalResult.url, detectedType, file.name);
      setUrlInput(finalResult.url);
      setUploadProgress(null);
      setUploadError(null);
      triggerToast(`Uploaded ${file.name} (${fileSizeMB} MB) successfully!`, 'success');
    } catch (err: any) {
      console.error('Media chunked upload error:', err);
      const errMsg = err.message || 'Media upload failed. Please try again.';
      setUploadError(errMsg);
      triggerToast(errMsg, 'error');
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      onMediaChanged('', 'image');
      return;
    }
    const detected: 'image' | 'video' = isVideoUrl(urlInput) ? 'video' : 'image';
    onMediaChanged(urlInput.trim(), detected);
    setPreviewError(false);
    triggerToast('Media URL updated!', 'success');
  };

  const handleClear = () => {
    setUrlInput('');
    onMediaChanged('', 'image');
    setPreviewError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasMedia = !!currentUrl;
  const isVideo = isVideoUrl(currentUrl);

  return (
    <div className="space-y-3">
      {/* Header Label & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-[11px] font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
            {acceptType === 'video' ? <Video className="w-3.5 h-3.5 text-[#d31d38]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#d31d38]" />}
            <span>{label}</span>
            {required && <span className="text-[#d31d38] font-bold">*</span>}
          </label>
          {subLabel && (
            <p className="text-[10px] text-zinc-500 mt-0.5">{subLabel}</p>
          )}
        </div>

        {/* Tab Switcher: Upload File vs Direct Link */}
        <div className="flex items-center bg-[#180608] border border-[#2e1015] rounded-lg p-0.5 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-[#d31d38] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-3 h-3" /> Upload File (Up to 250MB)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('url')}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeMode === 'url'
                ? 'bg-[#d31d38] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3 h-3" /> Direct URL
          </button>
        </div>
      </div>

      {/* Mode 1: Drag & Drop File Upload Area */}
      {activeMode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 relative group ${
              isDragging
                ? 'border-[#d31d38] bg-[#240a0e]/70'
                : 'border-[#2e1015] hover:border-[#d31d38]/60 bg-[#140608] hover:bg-[#180608]'
            } ${isUploading ? 'pointer-events-none opacity-90' : ''}`}
          >
            {isUploading ? (
              <div className="py-4 space-y-3 w-full max-w-sm mx-auto">
                <RefreshCw className="w-7 h-7 text-[#ff4d64] animate-spin mx-auto" />
                <p className="text-xs font-bold text-white">{uploadProgress || 'Uploading media...'}</p>
                
                {/* Progress bar */}
                <div className="w-full bg-[#180608] border border-[#2e1015] rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-[#d31d38] h-full transition-all duration-200 rounded-full"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>

                <span className="text-[10px] text-zinc-500 block">Streaming directly to high-capacity storage...</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#240a0e] text-[#ff4d64] flex items-center justify-center shadow-lg group-hover:scale-110 transition border border-[#2e1015]">
                  {acceptType === 'video' ? (
                    <Video className="w-6 h-6" />
                  ) : acceptType === 'image' ? (
                    <ImageIcon className="w-6 h-6" />
                  ) : (
                    <Film className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white">
                    Click to browse or drag & drop {acceptType === 'video' ? 'video (MP4, WebM, MOV, MKV)' : acceptType === 'image' ? 'image' : 'video or image'}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {acceptType === 'video' 
                      ? 'Supported formats: MP4, WebM, MOV, MKV, AVI, TS, M4V (Accepts files up to 250MB / 200MB+)'
                      : acceptType === 'image'
                      ? 'Supported formats: JPG, PNG, WebP, GIF, SVG (Up to 100MB)'
                      : 'Supports MP4, WebM, MOV, MKV, JPG, PNG, WebP (Accepts up to 250MB)'}
                  </p>
                </div>
              </>
            )}
          </div>

          {uploadError && (
            <div className="mt-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Upload Error</span>
                <span className="text-[11px] opacity-90">{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-rose-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Direct URL Input */}
      {activeMode === 'url' && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={() => {
                if (urlInput.trim() && urlInput.trim() !== currentUrl) {
                  handleApplyUrl();
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyUrl())}
              placeholder={acceptType === 'video' ? 'Paste video link (e.g. https://.../trailer.mp4 or /uploads/landing/...)' : 'Paste image link (e.g. https://.../poster.jpg)'}
              className="w-full bg-[#180608] border border-[#2e1015] rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-[#d31d38]"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-4 py-2.5 bg-[#240a0e] hover:bg-[#2e1015] text-[#ff4d64] hover:text-white border border-[#2e1015] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Apply URL
          </button>
        </div>
      )}

      {/* Media Preview & Playback Player Card */}
      {hasMedia && (
        <div className="bg-[#180608] border border-[#2e1015] rounded-2xl p-3.5 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                {isVideo ? <Video className="w-3.5 h-3.5 text-[#ff4d64]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#ff4d64]" />}
                {isVideo ? 'Active Video Media' : 'Active Image Media'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]" title={currentUrl}>
                {currentUrl}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-[#240a0e] transition cursor-pointer"
                title="Remove Media"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Player / Viewer */}
          <div className="w-full bg-black rounded-xl overflow-hidden border border-[#2e1015] relative group">
            {previewError ? (
              <div className="p-6 text-center text-zinc-500 space-y-1">
                <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">Media Preview</p>
                <p className="text-[10px] text-zinc-500">File link: {currentUrl}</p>
              </div>
            ) : isVideo ? (
              <div className="relative">
                <video
                  src={currentUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setPreviewError(true)}
                  className="w-full max-h-64 object-contain bg-black"
                >
                  <source src={currentUrl} />
                </video>
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" /> Video Ready
                </div>
              </div>
            ) : (
              <div className="relative max-h-64 overflow-hidden flex items-center justify-center bg-zinc-950">
                <img
                  src={currentUrl}
                  alt={label}
                  onError={() => setPreviewError(true)}
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
