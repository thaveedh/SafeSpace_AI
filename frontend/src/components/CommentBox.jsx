import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useDebounce } from '../hooks/useDebounce';
import ResultBar from './ResultBar';
import { Send, AlertTriangle } from 'lucide-react';

// --- ADDED CLOUD API URL ---
const API_BASE_URL = "https://thaveedhu-safespace-backend.hf.space";

export default function CommentBox({ isLocked, setIsLocked, strikes, setStrikes, userEmail }) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const debouncedText = useDebounce(text, 600);
  
  // FIXED: Using a standard .mp3 from a reliable source
  const sirenUrl = "https://www.soundjay.com/mechanical/sounds/smoke-detector-1.mp3";
  const sirenRef = useRef(new Audio(sirenUrl));

  const playSiren = () => {
    console.log("SIREN TRIGGERED - ATTEMPTING PLAYBACK");
    const audio = sirenRef.current;
    
    // Ensure volume is up and reset track
    audio.volume = 1.0;
    audio.currentTime = 0;

    audio.play()
      .then(() => {
        console.log("Siren playing successfully!");
        // Stop after 5 seconds exactly
        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 5000);
      })
      .catch(error => {
        console.error("Audio playback failed:", error);
      });
  };

  useEffect(() => {
    if (debouncedText.trim().length > 2 && !isLocked) {
      // --- UPDATED TO CLOUD URL ---
      axios.post(`${API_BASE_URL}/analyze`, { 
        text: debouncedText.trim(), 
        email: userEmail 
      })
      .then(res => {
        setAnalysis(res.data);
        if (res.data.is_hateful) {
          playSiren();
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
      .catch(err => console.log("Backend offline? Check Hugging Face Space status."));
    }
  }, [debouncedText]);

  const handlePost = async () => {
    if (!text.trim()) return;
    // --- UPDATED TO CLOUD URL ---
    await axios.post(`${API_BASE_URL}/submit`, { text: text.trim() });
    setText('');
    setAnalysis(null);
  };

  return (
    <div 
      className={`glass p-10 border-2 rounded-[2.5rem] transition-all duration-700 shadow-2xl ${
        isLocked ? 'border-red-600 bg-red-900/20' : 'border-slate-800 bg-black/20'
      }`}
      onClick={() => {
        // WARM UP: Plays silent audio to 'unlock' audio context on the first click
        const audio = sirenRef.current;
        audio.volume = 0;
        audio.play().then(() => {
            audio.pause();
            console.log("Audio Context Unlocked");
        }).catch(() => {});
      }}
    >
      <div className="flex justify-between items-center mb-8">
        <h3 className={`text-3xl font-black italic tracking-tighter uppercase transition-colors ${isLocked ? 'text-red-500' : 'text-white'}`}>
          AI MODERATOR
        </h3>
        {isLocked && (
          <div className="flex items-center gap-3 text-red-500 font-black animate-pulse bg-red-500/10 px-6 py-2 rounded-full border-2 border-red-500/50">
            <AlertTriangle size={24}/> SIREN ACTIVE
          </div>
        )}
      </div>

      <textarea 
        disabled={isLocked}
        className={`w-full h-56 p-8 bg-black/40 border-2 rounded-[2rem] text-2xl outline-none transition-all duration-500 text-white font-medium ${
          isLocked ? 'border-red-600' : 'border-slate-900 focus:border-indigo-500'
        }`}
        placeholder={isLocked ? "LOCKDOWN ACTIVE..." : "Type here to test..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      
      <div className="mt-8">
        <ResultBar analysis={analysis} />
        <div className="flex justify-end mt-8">
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