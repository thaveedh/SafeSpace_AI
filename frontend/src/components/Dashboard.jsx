import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { LogOut, History, ShieldAlert, Heart, CheckCircle2, BrainCircuit } from 'lucide-react';
import axios from 'axios';
import CommentBox from './CommentBox';

// REPLACE THIS WITH YOUR ACTUAL HUGGING FACE DIRECT URL
const API_BASE_URL = "https://thaveedhu-safespace-backend.hf.space";

export default function Dashboard({ user }) {
  const [isLocked, setIsLocked] = useState(false);
  const [history, setHistory] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [strikes, setStrikes] = useState(5);

  const fetchData = async () => {
    try {
      // Updated to use Cloud URL
      const histRes = await axios.get(`${API_BASE_URL}/history`);
      setHistory(histRes.data.reverse());
      
      const blockRes = await axios.get(`${API_BASE_URL}/blocked`);
      setBlocked(blockRes.data);

      const statusRes = await axios.get(`${API_BASE_URL}/user-status/${user.email}`);
      setStrikes(statusRes.data.strikes);
    } catch (e) { 
      console.log("Backend connection error. It might be sleeping."); 
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleModeration = async (text, action) => {
    const endpoint = action === 'HATE' ? 'learn' : 'ignore';
    // Updated to use Cloud URL
    await axios.post(`${API_BASE_URL}/${endpoint}`, { text });
    fetchData();
  };

  const undoBlock = async (text) => {
    // Updated to use Cloud URL
    await axios.post(`${API_BASE_URL}/unblock`, { text });
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8">
      {/* Header with Strikes */}
      <div className="flex justify-between items-center glass p-6 border-slate-800 rounded-3xl bg-slate-900/50">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-2xl text-white shadow-xl">{user.email[0].toUpperCase()}</div>
          <div><h2 className="font-black text-xl text-white">{user.displayName || "User"}</h2><p className="text-[10px] font-mono text-slate-500">{user.email}</p></div>
        </div>
        
        {/* LIFE METER (HEARTS) */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Life Meter</span>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <Heart key={i} size={28} fill={i < strikes ? "#ef4444" : "transparent"} className={i < strikes ? "text-red-500" : "text-slate-800 transition-all duration-700"} />
            ))}
          </div>
        </div>

        <button onClick={() => auth.signOut()} className="bg-slate-900 p-4 rounded-2xl hover:text-red-500 border border-slate-800 transition-all"><LogOut size={22}/></button>
      </div>

      <div className="grid lg:grid-cols-10 gap-8">
        <div className="lg:col-span-6">
          <CommentBox 
            isLocked={isLocked} 
            setIsLocked={setIsLocked} 
            strikes={strikes} 
            setStrikes={setStrikes} 
            userEmail={user.email} 
          />
        </div>
        
        <div className="lg:col-span-4 space-y-6">
          <div className="glass p-6 h-[350px] border-slate-800 flex flex-col rounded-3xl">
            <h3 className="font-black flex items-center gap-3 mb-4 text-indigo-400 uppercase italic text-sm"><History size={18}/> New Activity</h3>
            <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
              {history.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <p className="text-slate-300 text-xs italic mb-3">"{item.text}"</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleModeration(item.text, 'SAFE')} className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">SAFE</button>
                    <button onClick={() => handleModeration(item.text, 'HATE')} className="flex-1 py-2 bg-red-500/10 text-red-500 text-[10px] font-black rounded-lg border border-red-500/20 hover:bg-red-600 hover:text-white transition-all">HATE</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6 h-[350px] border-red-900/30 flex flex-col rounded-3xl bg-red-950/5">
            <h3 className="font-black flex items-center gap-3 mb-4 text-red-500 uppercase italic text-sm"><BrainCircuit size={18}/> Blocked Memory</h3>
            <div className="flex-grow overflow-y-auto space-y-3 custom-scrollbar">
              {blocked.map((item, idx) => (
                <div key={idx} className="p-4 bg-red-900/10 rounded-2xl border border-red-900/20 flex justify-between items-center">
                  <span className="text-red-200 text-xs font-bold">"{item.text}"</span>
                  <button onClick={() => undoBlock(item.text)} className="p-2 text-slate-500 hover:text-emerald-500 transition-all bg-black/40 rounded-lg"><CheckCircle2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}