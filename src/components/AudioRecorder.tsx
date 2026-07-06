import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Trash, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onSave: (audioBase64: string) => void;
  initialAudio?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSave, initialAudio }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudio || null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAudioUrl(base64Audio);
          onSave(base64Audio);
          // Stop all audio tracks to free up mic
          stream.getTracks().forEach(track => track.stop());
        };
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Microphone access is required for voice notes. Please grant microphone permissions in your browser settings and try again.");
    }
  };
  
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };
  
  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };
  
  const deleteAudio = () => {
    setAudioUrl(null);
    onSave('');
  };

  return (
    <div className="flex items-center gap-2 p-3 border border-neutral-200 rounded-xl bg-neutral-50 shadow-sm transition-all hover:border-neutral-300">
      <span className="text-[10px] font-bold uppercase text-neutral-450 font-mono tracking-wider mr-1">Voice Note</span>
      
      {!isRecording && !audioUrl && (
        <button type="button" onClick={startRecording} className="flex items-center gap-2 px-3 py-1.5 bg-[#00B87A] text-white rounded-lg hover:bg-emerald-600 transition text-[11px] font-bold shadow-sm cursor-pointer">
          <Mic className="w-3.5 h-3.5" /> Start Recording
        </button>
      )}
      {isRecording && (
        <button type="button" onClick={stopRecording} className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-[11px] font-bold shadow-sm cursor-pointer">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording... <Square className="w-3.5 h-3.5" /> Stop
        </button>
      )}
      {audioUrl && !isRecording && (
        <>
          <button type="button" onClick={playAudio} className="p-1.5 bg-white text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition cursor-pointer shadow-sm">
            <Play className="w-4 h-4" />
          </button>
          <button type="button" onClick={deleteAudio} className="p-1.5 bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition cursor-pointer shadow-sm">
            <Trash className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
            Captured
          </span>
        </>
      )}
    </div>
  );
};
