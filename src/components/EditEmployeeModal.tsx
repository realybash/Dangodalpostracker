import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { X, Pencil, Check, Camera, Trash2, Upload } from 'lucide-react';
import { playStatusSound } from './TransactionForm';

interface EditEmployeeModalProps {
  employee: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
}

export function EditEmployeeModal({ employee, onUpdateUser, onClose }: EditEmployeeModalProps) {
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone || '');
  const [email, setEmail] = useState(employee.email || '');
  const [areaOfWorking, setAreaOfWorking] = useState(employee.areaOfWorking || '');
  const [avatar, setAvatar] = useState(employee.avatar || '');
  const [pin, setPin] = useState(employee.pin || '1111');
  const [activated, setActivated] = useState(employee.activated !== false);
  const [error, setError] = useState('');

  // Camera integration state
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCapturing(true);
    setCameraError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 300, height: 300 },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please check permissions.');
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 300;
      canvas.height = video.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the frame mirrored
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(dataUrl);
        stopCamera();
      }
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (pin.length !== 4 || isNaN(Number(pin))) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    const updated: User = {
      ...employee,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      areaOfWorking: areaOfWorking.trim() || undefined,
      avatar,
      pin,
      activated
    };

    onUpdateUser(updated);
    playStatusSound('Success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 animate-fade-in text-neutral-800">
        <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-200" />
            <h3 className="font-extrabold text-sm tracking-tight">Edit Cashier Profile</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && <div className="p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono block">Profile Picture</label>
            
            {isCapturing ? (
              <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800 flex flex-col items-center gap-3">
                <div className="relative w-40 h-40 rounded-full overflow-hidden bg-neutral-900 border border-neutral-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Snap Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-extrabold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {cameraError && (
                  <p className="text-[10px] text-red-400 font-bold text-center mt-1">{cameraError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 relative group">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-neutral-400">{name.charAt(0)}</span>
                  )}
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar('')}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 rounded-full text-white cursor-pointer"
                      title="Remove Picture"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={triggerUploadClick}
                      className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-neutral-400" />
                      Upload File
                    </button>
                    
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-neutral-400" />
                      Take Photo
                    </button>
                  </div>
                  <p className="text-[9px] text-neutral-400 font-medium">PNG or JPG. Live capture available.</p>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Phone Contact</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Email Recovery</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Work Area/Location</label>
            <input
              type="text"
              value={areaOfWorking}
              onChange={(e) => setAreaOfWorking(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">4-Digit PIN Passcode</label>
            <input
              type="text"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-extrabold text-sm focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
              required
            />
          </div>

          <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <input
              type="checkbox"
              id="editActivated"
              checked={activated}
              onChange={(e) => setActivated(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
            <label htmlFor="editActivated" className="text-xs font-bold text-neutral-600 cursor-pointer select-none">
              Account Activated
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
