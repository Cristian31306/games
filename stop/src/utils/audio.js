const getContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    return new AudioContext();
};

let audioCtx = null;

const initAudio = () => {
    if (!audioCtx) audioCtx = getContext();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

export const playTick = () => {
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

export const playBuzzer = () => {
    initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
};

export const playWin = () => {
    initAudio();
    if (!audioCtx) return;
    const notes = [
        {f: 440, t: 0}, 
        {f: 554.37, t: 0.15}, 
        {f: 659.25, t: 0.3}, 
        {f: 880, t: 0.45}
    ];

    notes.forEach(note => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, audioCtx.currentTime + note.t);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + note.t);
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + note.t + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + note.t + 0.5);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime + note.t);
        osc.stop(audioCtx.currentTime + note.t + 0.5);
    });
};
