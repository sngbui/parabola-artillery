import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RefreshCw, Crosshair } from 'lucide-react';

const CanvasWidth = 800;
const CanvasHeight = 480;
const PixelsPerUnit = 40; // 20 units wide (-10 to 10), 12 units high (-2 to 10)

// Converts absolute world coordinates to screen pixels
const toScreen = (worldX, worldY) => {
  return {
    sx: (worldX + 10) * PixelsPerUnit,
    sy: CanvasHeight - (worldY + 2) * PixelsPerUnit
  };
};

export default function App() {
  // Game State
  const [gameState, setGameState] = useState('playing'); // playing, animating, gameover
  const [turn, setTurn] = useState(1);
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [message, setMessage] = useState("Player 1's Turn!");
  
  // Timer and Round State
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // Floating text state for impacts
  const [impactTexts, setImpactTexts] = useState([]);

  // Dynamic Environment State
  const [mountain, setMountain] = useState({ peakX: 0, height: 4, halfWidth: 2.5 });
  const [p1X, setP1X] = useState(-8);
  const [p2X, setP2X] = useState(8);

  // Parabola Coefficients
  const [a, setA] = useState(-0.05);
  const [b, setB] = useState(0.8);
  const [c, setC] = useState(0);

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({ a, b, c, turn, gameState, p1Health, p2Health, impactTexts, mountain, p1X, p2X, round });

  useEffect(() => {
    stateRef.current = { a, b, c, turn, gameState, p1Health, p2Health, impactTexts, mountain, p1X, p2X, round };
    if (gameState === 'playing') {
      drawScene(); 
    }
  }, [a, b, c, turn, gameState, p1Health, p2Health, impactTexts, mountain, p1X, p2X, round]);

  useEffect(() => {
    drawScene();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Set default values pointing towards the opponent when turn switches
  useEffect(() => {
    if (gameState === 'playing') {
       if (turn === 1) {
         setA(-0.05); setB(0.8); setC(0);
       } else {
         setA(-0.05); setB(-0.8); setC(0); // Negative b shoots to the left!
       }
    }
  }, [turn, gameState]);

  // Timer Countdown Logic
  useEffect(() => {
    if (gameState === 'playing' && round >= 2 && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (gameState === 'playing' && round >= 2 && timeLeft === 0) {
      setGameState('animating'); // Lock input immediately
      endTurn("Time's up! You missed your shot.");
    }
  }, [timeLeft, gameState, round]);

  const drawScene = (projectile = null, particles = []) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { turn, a, b, c, p1Health, p2Health, mountain } = stateRef.current;

    const activeOriginX = turn === 1 ? stateRef.current.p1X : stateRef.current.p2X;

    // 1. Clear & Beautiful Sky Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CanvasHeight);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CanvasWidth, CanvasHeight);
    
    // Draw Holographic Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = -10; x <= 10; x++) {
      const { sx } = toScreen(x, 0);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, CanvasHeight); ctx.stroke();
    }
    for (let y = -2; y <= 10; y++) {
      const { sy } = toScreen(0, y);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(CanvasWidth, sy); ctx.stroke();
    }

    // X-Axis (Ground Line)
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    const origin = toScreen(activeOriginX, 0);
    ctx.beginPath(); ctx.moveTo(0, origin.sy); ctx.lineTo(CanvasWidth, origin.sy); ctx.stroke(); 
    
    // Marker for Origin
    ctx.fillStyle = turn === 1 ? '#60a5fa' : '#f87171';
    ctx.font = '14px monospace';
    ctx.fillText("x=0 Origin", origin.sx - 35, origin.sy + 20);
    ctx.beginPath();
    ctx.arc(origin.sx, origin.sy, 4, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Terrain (Stylized Mountains & Ground)
    // Ground
    const groundGrad = ctx.createLinearGradient(0, origin.sy, 0, CanvasHeight);
    groundGrad.addColorStop(0, '#064e3b'); // Dark green
    groundGrad.addColorStop(1, '#022c22');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, origin.sy, CanvasWidth, CanvasHeight - origin.sy);
    
    // Mountain
    const { peakX, height, halfWidth } = mountain;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(toScreen(peakX - halfWidth, 0).sx, toScreen(peakX - halfWidth, 0).sy);
    ctx.lineTo(toScreen(peakX, height).sx, toScreen(peakX, height).sy);
    ctx.lineTo(toScreen(peakX + halfWidth, 0).sx, toScreen(peakX + halfWidth, 0).sy);
    ctx.fill();
    
    // Mountain Highlight (3D effect)
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(toScreen(peakX, height).sx, toScreen(peakX, height).sy);
    ctx.lineTo(toScreen(peakX + halfWidth, 0).sx, toScreen(peakX + halfWidth, 0).sy);
    ctx.lineTo(toScreen(peakX, 0).sx, toScreen(peakX, 0).sy);
    ctx.fill();

    // 4. Draw Parabola Preview (Glowing neon effect)
    if (!projectile) {
      // --- Draw Line of Symmetry (Amber to match 'b') ---
      if (Math.abs(a) > 0.001) { // Prevent division by zero
        const symLocalX = -b / (2 * a);
        const symWorldX = activeOriginX + symLocalX;
        
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#fbbf24'; // Tailwind amber-400
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        // Draw from top of graph to bottom
        const topPos = toScreen(symWorldX, 10);
        const bottomPos = toScreen(symWorldX, -2);
        
        ctx.moveTo(topPos.sx, topPos.sy);
        ctx.lineTo(bottomPos.sx, bottomPos.sy);
        ctx.stroke();

        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = turn === 1 ? '#60a5fa' : '#f87171';
      ctx.lineWidth = 4;
      ctx.shadowColor = turn === 1 ? '#3b82f6' : '#ef4444';
      ctx.shadowBlur = 10;
      
      const endLocalX = turn === 1 ? 20 : -20;
      const step = turn === 1 ? 0.2 : -0.2;

      for (let localX = 0; Math.abs(localX) <= Math.abs(endLocalX); localX += step) {
        // Equation relative to the active player's local x
        const localY = a * localX * localX + b * localX + c;
        const worldX = activeOriginX + localX;
        
        const pos = toScreen(worldX, localY);
        if (localX === 0) ctx.moveTo(pos.sx, pos.sy);
        else ctx.lineTo(pos.sx, pos.sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Players
    drawTank(ctx, stateRef.current.p1X, '#3b82f6', '#60a5fa', p1Health, turn === 1, turn === 1 ? c : 0);
    drawTank(ctx, stateRef.current.p2X, '#ef4444', '#f87171', p2Health, turn === 2, turn === 2 ? c : 0);

    // 6. Draw Projectile & Particles
    if (projectile) {
      const pos = toScreen(projectile.x, projectile.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();
      
      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.fill();
    }

    particles.forEach(p => {
      if (p.isShockwave) {
        ctx.beginPath();
        const radius = Math.max(1, (15 - p.life) * 6);
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, p.life / 15)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / 50); // Fade out over time
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0; // Reset alpha
      }
    });
  };

  const drawTank = (ctx, worldX, color, glowColor, health, isActive, currentC) => {
    const groundPos = toScreen(worldX, 0);
    const cannonPos = toScreen(worldX, currentC);

    // Energy beam/track for cannon height
    ctx.save();
    ctx.strokeStyle = isActive ? glowColor : '#475569';
    ctx.lineWidth = 4;
    ctx.globalAlpha = isActive ? 0.6 : 0.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(groundPos.sx, groundPos.sy);
    ctx.lineTo(cannonPos.sx, cannonPos.sy);
    ctx.stroke();
    ctx.restore();

    // Cannon Mount
    ctx.fillStyle = isActive ? glowColor : '#64748b';
    ctx.beginPath();
    ctx.arc(cannonPos.sx, cannonPos.sy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Cannon Barrel
    const barrelDir = worldX < 0 ? 1 : -1;
    ctx.fillStyle = isActive ? '#ffffff' : '#94a3b8';
    ctx.fillRect(cannonPos.sx + (barrelDir * 5), cannonPos.sy - 4, 20 * barrelDir, 8);

    // Tank Body (Sci-fi style)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(groundPos.sx - 20, groundPos.sy - 15);
    ctx.lineTo(groundPos.sx + 20, groundPos.sy - 15);
    ctx.lineTo(groundPos.sx + 25, groundPos.sy);
    ctx.lineTo(groundPos.sx - 25, groundPos.sy);
    ctx.fill();
    
    // Tank color highlight
    ctx.fillStyle = color;
    ctx.fillRect(groundPos.sx - 15, groundPos.sy - 15, 30, 4);

    // Treads
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(groundPos.sx - 26, groundPos.sy - 5, 52, 10, 5);
    ctx.fill();

    // Health Bar
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(groundPos.sx - 20, groundPos.sy + 12, 40, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(groundPos.sx - 20, groundPos.sy + 12, (health / 100) * 40, 4);
  };

  // --- GAMEPLAY LOGIC ---
  const generateNewLevel = () => {
    // Generate new random constraints for the mountain
    const newHeight = 2 + Math.random() * 5; // Height between 2 and 7
    const newHalfWidth = 1.5 + Math.random() * 2.5; // Width span between 1.5 and 4.0
    
    // Guarantee players don't spawn inside the mountain
    const p1Max = -(newHalfWidth + 1.2);
    const p1Min = -9.0;
    const newP1X = p1Min + Math.random() * (p1Max - p1Min);
    
    const p2Min = newHalfWidth + 1.2;
    const p2Max = 9.0;
    const newP2X = p2Min + Math.random() * (p2Max - p2Min);

    setMountain({ peakX: 0, height: newHeight, halfWidth: newHalfWidth });
    setP1X(newP1X);
    setP2X(newP2X);
  };

  const handleFire = () => {
    if (gameState !== 'playing') return;
    setGameState('animating');
    setMessage("Firing!");
    
    const { a, b, c, turn } = stateRef.current;
    
    const activeOriginX = turn === 1 ? stateRef.current.p1X : stateRef.current.p2X;
    let localX = 0;
    const direction = turn === 1 ? 0.08 : -0.08; // Reduced speed for better tracking
    let particles = [];
    let isHit = false;
    let worldX = activeOriginX;
    let worldY = c;

    const animate = () => {
      if (!isHit) {
        // 1. Math Step (in Local Coordinates)
        localX += direction;
        const localY = a * localX * localX + b * localX + c;
        
        // Convert to World Coordinates for physical collision
        worldX = activeOriginX + localX;
        worldY = localY;

        // --- Collision Detection ---
        const { turn, p1Health, p2Health, mountain, p1X, p2X } = stateRef.current;
        
        // 1. Mountain Collision
        const { peakX, height, halfWidth } = mountain;
        const mountainHeightAtX = Math.max(0, height - (height/halfWidth) * Math.abs(worldX - peakX));
        if (worldY <= mountainHeightAtX && Math.abs(worldX - peakX) < halfWidth) {
          triggerExplosion(worldX, worldY, '#6b7280', particles);
          isHit = true;
          endTurn("Blocked by the mountain! Adjust your math.");
        }
        // 2. Ground/Target Collision
        else if (worldY <= 0) {
          // Player Hitbox checks (Tanks are 1.5 units wide roughly)
          if (turn === 1 && Math.abs(worldX - p2X) < 1.5) {
             handleHit(2, particles, worldX);
             isHit = true;
          } else if (turn === 2 && Math.abs(worldX - p1X) < 1.5) {
             handleHit(1, particles, worldX);
             isHit = true;
          } else {
             triggerExplosion(worldX, 0, '#8bc34a', particles);
             isHit = true;
             endTurn("Hit the ground. Check your roots!");
          }
        }
        // 3. Out of bounds
        else if (worldX < -11 || worldX > 11 || worldY < -3) {
           isHit = true;
           endTurn("Shot went out of bounds!");
        }
      }

      // Update Particles (slowly shrink and fade)
      particles = particles.map(p => ({
        ...p, sx: p.sx + p.vx, sy: p.sy + p.vy, life: p.life - 1, size: Math.max(0, (p.size || 0) - 0.1)
      })).filter(p => p.life > 0);

      drawScene(isHit ? null : { x: worldX, y: worldY }, particles);

      // Keep animating if projectile is still flying OR particles are still fading
      if (!isHit || particles.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  const triggerExplosion = (worldX, worldY, baseColor, particlesArray) => {
    const pos = toScreen(worldX, worldY);
    
    // Add Shockwave effect
    particlesArray.push({
      sx: pos.sx, sy: pos.sy, vx: 0, vy: 0, size: 0, color: '#ffffff', life: 15, isShockwave: true
    });

    for (let i = 0; i < 40; i++) {
      particlesArray.push({
        sx: pos.sx, sy: pos.sy,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16 - 2, // Slight upward bias
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.4 ? baseColor : (Math.random() > 0.5 ? '#fde047' : '#ef4444'),
        life: 20 + Math.random() * 30,
        isShockwave: false
      });
    }
  };

  const spawnImpactText = (text, worldX) => {
    const newImpact = {
      id: Date.now(),
      text,
      // Convert world X to a percentage for CSS positioning over the canvas
      left: `${((worldX + 10) / 20) * 100}%`,
      bottom: '20%' // Hardcoded slightly above ground
    };
    
    setImpactTexts(prev => [...prev, newImpact]);
    
    // Remove text after animation completes
    setTimeout(() => {
      setImpactTexts(prev => prev.filter(t => t.id !== newImpact.id));
    }, 1500);
  };

  const handleHit = (targetPlayer, particlesArray, hitX) => {
    triggerExplosion(hitX, 0, '#ef4444', particlesArray);
    
    const damage = 35;
    spawnImpactText(`-${damage}`, hitX);

    if (targetPlayer === 1) {
      const newHealth = Math.max(0, stateRef.current.p1Health - damage);
      setP1Health(newHealth);
      if (newHealth === 0) finishGame(2);
      else endTurn("Direct Hit! Player 1 takes damage.");
    } else {
      const newHealth = Math.max(0, stateRef.current.p2Health - damage);
      setP2Health(newHealth);
      if (newHealth === 0) finishGame(1);
      else endTurn("Direct Hit! Player 2 takes damage.");
    }
  };

  const endTurn = (msg) => {
    setMessage(msg);
    // Let explosion particles animate for a brief moment
    setTimeout(() => {
      if (stateRef.current.gameState === 'gameover') return;
      
      const currentTurn = stateRef.current.turn;
      const currentRound = stateRef.current.round;
      const nextTurn = currentTurn === 1 ? 2 : 1;
      
      if (nextTurn === 1) {
         // Full round completed! Change level.
         const nextRound = currentRound + 1;
         setRound(nextRound);
         generateNewLevel();
         if (nextRound === 2) {
           setMessage("Round 2! You now have 60 seconds per turn!");
         } else {
           setMessage("Round Complete! Terrain shifted. Player 1's Turn!");
         }
      } else {
         setMessage(`Player 2's Turn!`);
      }

      setTurn(nextTurn);
      setTimeLeft(60); // Reset timer for the next turn
      setGameState('playing');
    }, 2500);
  };

  const finishGame = (winner) => {
    setGameState('gameover');
    setMessage(`Player ${winner} Wins the Math Battle!`);
  };

  const restartGame = () => {
    setP1Health(100);
    setP2Health(100);
    setTurn(1);
    setRound(1);
    setTimeLeft(60);
    setA(-0.05); setB(0.8); setC(0);
    setImpactTexts([]);
    setMountain({ peakX: 0, height: 4, halfWidth: 2.5 });
    setP1X(-8);
    setP2X(8);
    setGameState('playing');
    setMessage("Player 1's Turn!");
  };

  const formatValue = (val) => val >= 0 ? `+ ${val.toFixed(2)}` : `- ${Math.abs(val).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center justify-center p-4">
      
      {/* HEADER */}
      <div className="w-full max-w-4xl text-center mb-4">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400 drop-shadow-md">Parabola Artillery</h1>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="w-full max-w-4xl relative shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border-4 border-slate-700 bg-slate-900">
        
        {/* Centered Equation Overlay */}
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-600 rounded-xl px-6 py-3 shadow-2xl">
            <div className="text-3xl font-mono tracking-tight font-bold whitespace-nowrap">
              <span className="text-white">y = </span>
              <span className="text-purple-400">{a.toFixed(2)}</span><span className="text-slate-300">x²</span>
              <span className="text-amber-400"> {formatValue(b)}</span><span className="text-slate-300">x</span>
              <span className="text-green-400"> {formatValue(c)}</span>
            </div>
          </div>
        </div>

        {/* Timer Overlay */}
        {round >= 2 && (
          <div className="absolute top-16 right-6 z-20 flex items-center justify-center pointer-events-none">
            <div className={`text-4xl font-mono tracking-tight font-extrabold px-6 py-3 rounded-xl border-2 backdrop-blur-md transition-colors duration-300 shadow-2xl ${
              timeLeft <= 10 
                ? 'bg-red-900/90 border-red-500 text-red-400 animate-pulse' 
                : 'bg-slate-900/90 border-slate-600 text-white'
            }`}>
              ⏱️ {timeLeft}s
            </div>
          </div>
        )}

        {/* Status Overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-between px-6 pointer-events-none z-10">
           <div className={`px-4 py-2 rounded-lg font-bold text-lg ${turn === 1 ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.8)]' : 'bg-slate-800 text-slate-400'}`}>
              P1 Health: {Math.round(p1Health)}%
           </div>
           
           <div className="bg-slate-900/80 px-6 py-2 rounded-full font-bold text-slate-200 border border-slate-600 animate-pulse">
              {message}
           </div>

           <div className={`px-4 py-2 rounded-lg font-bold text-lg ${turn === 2 ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-slate-800 text-slate-400'}`}>
              P2 Health: {Math.round(p2Health)}%
           </div>
        </div>

        {/* Floating Impact Texts */}
        {impactTexts.map((impact) => (
          <div 
            key={impact.id}
            className="absolute text-5xl font-extrabold text-red-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] pointer-events-none"
            style={{ 
              left: impact.left, 
              bottom: impact.bottom, 
              transform: 'translateX(-50%)',
              animation: 'floatUp 1.5s ease-out forwards'
            }}
          >
            {impact.text}
          </div>
        ))}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center backdrop-blur-sm z-30">
            <Trophy size={64} className="text-yellow-400 mb-4" />
            <h2 className="text-4xl font-bold text-white mb-6">{message}</h2>
            <button 
              onClick={restartGame}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full font-bold text-xl transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw size={24} /> Play Again
            </button>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={CanvasWidth} 
          height={CanvasHeight}
          className="w-full h-auto block"
        />

        {/* Inline CSS for the floating text animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes floatUp {
            0% { opacity: 1; transform: translate(-50%, 0) scale(0.5); }
            20% { transform: translate(-50%, -20px) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -80px) scale(1); }
          }
        `}} />
      </div>

      {/* DASHBOARD / CONTROLS */}
      <div className={`w-full max-w-4xl mt-6 grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl border-2 transition-colors duration-300 ${turn === 1 ? 'bg-blue-950/40 border-blue-800' : 'bg-red-950/40 border-red-800'}`}>
        
        {/* Sliders */}
        <div className="md:col-span-3 grid grid-cols-1 gap-4">
          
          <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
            <label className="text-purple-400 font-bold w-48 flex justify-between text-sm">
              <span>a (coefficient of x²)</span> <span>{a.toFixed(2)}</span>
            </label>
            <input 
              type="range" min="-0.2" max="0.2" step="0.01" 
              value={a} onChange={(e) => setA(parseFloat(e.target.value))}
              disabled={gameState !== 'playing'}
              className="flex-1 accent-purple-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
            <label className="text-amber-400 font-bold w-48 flex justify-between text-sm">
              <span>b (coefficient of x)</span> <span>{b.toFixed(2)}</span>
            </label>
            <input 
              type="range" min="-5" max="5" step="0.1" 
              value={b} onChange={(e) => setB(parseFloat(e.target.value))}
              disabled={gameState !== 'playing'}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
            <label className="text-green-400 font-bold w-48 flex justify-between text-sm">
              <span>c (constant)</span> <span>{c.toFixed(1)}</span>
            </label>
            <input 
              type="range" min="-2" max="10" step="0.5" 
              value={c} onChange={(e) => setC(parseFloat(e.target.value))}
              disabled={gameState !== 'playing'}
              className="flex-1 accent-green-500 cursor-pointer"
            />
          </div>

        </div>

        {/* Action Button */}
        <div className="flex flex-col justify-center">
          <button 
            onClick={handleFire}
            disabled={gameState !== 'playing'}
            className={`w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-b-4 font-bold text-2xl transition-all
              ${gameState !== 'playing' 
                ? 'bg-slate-700 text-slate-500 border-slate-800 cursor-not-allowed' 
                : turn === 1 
                  ? 'bg-blue-600 hover:bg-blue-500 border-blue-800 active:border-b-0 active:translate-y-1 text-white' 
                  : 'bg-red-600 hover:bg-red-500 border-red-800 active:border-b-0 active:translate-y-1 text-white'}`}
          >
            <Crosshair size={32} />
            FIRE!
          </button>
        </div>
      </div>

    </div>
  );
}