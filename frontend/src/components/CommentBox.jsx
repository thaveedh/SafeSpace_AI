import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useDebounce } from '../hooks/useDebounce';
import ResultBar from './ResultBar';
import { Send, AlertTriangle, Volume2, VolumeX } from 'lucide-react';

const API_BASE_URL = "https://thaveedhu-safespace-backend.hf.space";
const sirenUrl = "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

export default function CommentBox({ isLocked, setIsLocked, strikes, setStrikes, userEmail }) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false); // Track if user unlocked audio
  const debouncedText = useDebounce(text, 600);
  
  // Persistent Audio Reference
  const audioRef = useRef(new Audio(sirenUrl));

  // Function to unlock audio (Required by Edge/Chrome)
  const enableAudio = () => {
    const audio = audioRef.current;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
      setIsAudioEnabled(true);
      console.log("🔊 Audio Context Unlocked");
    }).catch(err => console.log("Click again to enable audio"));
  };

  const playSiren = () => {
    if (!isAudioEnabled) return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Playback failed"));
    
    // Stop after 5 seconds
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 5000);
  };

  useEffect(() => {
    if (debouncedText.trim().length > 2 && !isLocked) {
      axios.post(`${API_BASE_URL}/analyze`, { 
        text: debouncedText.trim(), 
        email: userEmail 
      })
      .then(res => {
        setAnalysis(res.data);
        if (res.data.is_hateful) {
          playSiren(); // Triggers the sound
          setStrikes(res.data.remaining_strikes);
          setIsLocked(true);
          
          if (res.data.remaining_strikes === 0) {
            setTimeout(() => auth.signOut(), 5000);
          } else {
            setTimeout(() => {
              setIsLocked(false);
              setText('');
              setAnalysis(null);
            }, 5000);
          }
        }
      })
      .catch(err => console.log("Backend offline?"));
    }
  }, [debouncedText]);

  const handlePost = async () => {
    if (!text.trim()) return;
    await axios.post(`${API_BASE_URL}/submit`, { text: text.trim() });
    setText('');
    setAnalysis(null);
  };

  return (
    <div 
      className={`glass p-10 border-2 rounded-[2.5rem] transition-all duration-700 shadow-2xl ${
        isLocked ? 'border-red-600 bg-red-900/20' : 'border-slate-800 bg-black/20'
      }`}
    >
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h3 className={`text-3xl font-black italic tracking-tighter uppercase transition-colors ${isLocked ? 'text-red-500' : 'text-white'}`}>
            AI MODERATOR
          </h3>
          {/* AUDIO UNLOCK BUTTON - Visual indicator for the user */}
          <button 
            onClick={enableAudio}
            className={`p-2 rounded-xl border transition-all ${isAudioEnabled ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse'}`}
          >
            {isAudioEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
          </button>
        </div>

        {isLocked && (
          <div className="flex items-center gap-3 text-red-500 font-black animate-pulse bg-red-500/10 px-6 py-2 rounded-full border-2 border-red-500/50">
            <AlertTriangle size={24}/> SIREN ACTIVE
          </div>
        )}
      </div>

      <textarea 
        disabled={isLocked}
        onClick={!isAudioEnabled ? enableAudio : null} // Unlocks on first click of textarea too
        className={`w-full h-56 p-8 bg-black/40 border-2 rounded-[2rem] text-2xl outline-none transition-all duration-500 text-white font-medium ${
          isLocked ? 'border-red-600' : 'border-slate-900 focus:border-indigo-500'
        }`}
        placeholder={isLocked ? "LOCKDOWN ACTIVE..." : "Click here and type to test..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      
      <div className="mt-8">
        <ResultBar analysis={analysis} />
        <div className="flex justify-end mt-8 gap-4 items-center">
            {!isAudioEnabled && <span className="text-amber-500 text-xs font-bold animate-bounce">Click box to enable sound 🔊</span>}
          <button 
            onClick={handlePost} 
            disabled={isLocked || !text.trim()} 
            className="bg-indigo-600 py-4 px-16 rounded-2xl font-black text-xl text-white hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-0"
          >
            POST COMMENT
          </button>
        </div>
      </div>
    </div>
  );
}