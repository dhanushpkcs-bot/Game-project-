
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Team, GameStage, GameState, BallOutcomeType, Innings, BallRecord } from './types';
import { generateCommentary, generateResultSummary } from './services/geminiService';

const MAX_OVERS = 2;
const MAX_WICKETS = 2;
const BALLS_PER_OVER = 6;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.Toss,
    innings1: null,
    innings2: null,
    tossWinner: null,
    userDecision: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCommentary, setCurrentCommentary] = useState("Welcome to the MCG! It's time for the toss.");
  const [lastBallSummary, setLastBallSummary] = useState<string>("");
  const [isFreeHit, setIsFreeHit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.innings1?.history, gameState.innings2?.history]);

  const handleToss = (call: 'Heads' | 'Tails') => {
    const coin = Math.random() > 0.5 ? 'Heads' : 'Tails';
    const won = coin === call;
    const winner = won ? Team.User : Team.Computer;
    
    setGameState(prev => ({
      ...prev,
      tossWinner: winner,
    }));
    
    if (winner === Team.Computer) {
      const decision = Math.random() > 0.5 ? 'Bat' : 'Bowl';
      setCurrentCommentary(`Computer wins the toss and chooses to ${decision}.`);
      setTimeout(() => startMatch(decision === 'Bat' ? 'Bowl' : 'Bat'), 1500);
    } else {
      setCurrentCommentary("You won the toss! What will you do?");
    }
  };

  const startMatch = (userDecision: 'Bat' | 'Bowl') => {
    const battingFirst = userDecision === 'Bat' ? Team.User : Team.Computer;
    const bowlingFirst = userDecision === 'Bowl' ? Team.User : Team.Computer;

    setGameState(prev => ({
      ...prev,
      userDecision,
      stage: GameStage.Innings1,
      innings1: createNewInnings(battingFirst, bowlingFirst),
    }));
    setCurrentCommentary(`Match started! ${battingFirst} is batting first.`);
  };

  const createNewInnings = (battingTeam: Team, bowlingTeam: Team): Innings => ({
    battingTeam,
    bowlingTeam,
    totalRuns: 0,
    wickets: 0,
    ballsBowled: 0,
    maxOvers: MAX_OVERS,
    maxWickets: MAX_WICKETS,
    history: [],
    isComplete: false,
    onStrikePlayerIndex: 0,
  });

  const handleAction = async (userValue: number) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const activeInningsKey = gameState.stage === GameStage.Innings1 ? 'innings1' : 'innings2';
    const activeInnings = gameState[activeInningsKey];
    if (!activeInnings || activeInnings.isComplete) return;

    // AI logic
    const aiValue = Math.floor(Math.random() * 7); // 0-6
    const deliveryRoll = Math.random();
    let outcomeType = BallOutcomeType.Normal;

    // Extras logic
    if (deliveryRoll < 0.05) outcomeType = BallOutcomeType.Wide;
    else if (deliveryRoll < 0.10) outcomeType = BallOutcomeType.NoBall;

    let runs = 0;
    let isWicket = false;
    let ballCounts = true;

    if (outcomeType === BallOutcomeType.Wide) {
      runs = 1;
      ballCounts = false;
    } else if (outcomeType === BallOutcomeType.NoBall) {
      runs = 1;
      ballCounts = false;
      setIsFreeHit(true);
    } else {
      // Normal ball
      if (userValue === aiValue && !isFreeHit) {
        isWicket = true;
      } else {
        runs = userValue;
      }
      if (isFreeHit) setIsFreeHit(false);
    }

    // Process result
    const newTotalRuns = activeInnings.totalRuns + runs;
    const newWickets = activeInnings.wickets + (isWicket ? 1 : 0);
    const newBallsBowled = activeInnings.ballsBowled + (ballCounts ? 1 : 0);
    
    // Strike rotation logic
    let newStrike = activeInnings.onStrikePlayerIndex;
    if (runs % 2 !== 0 && outcomeType !== BallOutcomeType.Wide && outcomeType !== BallOutcomeType.NoBall) {
      newStrike = newStrike === 0 ? 1 : 0;
    }
    if (ballCounts && newBallsBowled % BALLS_PER_OVER === 0 && newBallsBowled > 0) {
      newStrike = newStrike === 0 ? 1 : 0; // Over end strike change
    }

    const commentary = await generateCommentary(userValue, aiValue, isWicket, outcomeType, runs, isFreeHit);
    
    const ballRecord: BallRecord = {
      over: Math.floor(newBallsBowled / BALLS_PER_OVER),
      ballNumber: (newBallsBowled % BALLS_PER_OVER) || BALLS_PER_OVER,
      runs,
      isWicket,
      outcomeType,
      commentary,
      shot: userValue,
    };

    const updatedInnings: Innings = {
      ...activeInnings,
      totalRuns: newTotalRuns,
      wickets: newWickets,
      ballsBowled: newBallsBowled,
      onStrikePlayerIndex: newStrike,
      history: [...activeInnings.history, ballRecord],
    };

    // Check innings end conditions
    const oversFinished = newBallsBowled >= MAX_OVERS * BALLS_PER_OVER;
    const allOut = newWickets >= MAX_WICKETS;
    
    // Chasing logic for 2nd innings
    let targetMet = false;
    if (gameState.stage === GameStage.Innings2 && gameState.innings1) {
      if (newTotalRuns > gameState.innings1.totalRuns) {
        targetMet = true;
      }
    }

    if (oversFinished || allOut || targetMet) {
      updatedInnings.isComplete = true;
    }

    setGameState(prev => ({
      ...prev,
      [activeInningsKey]: updatedInnings,
    }));

    setCurrentCommentary(commentary);
    setLastBallSummary(`${isWicket ? 'WICKET!' : runs + ' runs'} (${outcomeType})`);
    setIsProcessing(false);

    if (updatedInnings.isComplete) {
      handleInningsEnd(updatedInnings);
    }
  };

  const handleInningsEnd = (innings: Innings) => {
    if (gameState.stage === GameStage.Innings1) {
      setTimeout(() => {
        setGameState(prev => ({ ...prev, stage: GameStage.InningsBreak }));
        setCurrentCommentary(`Innings break! Target is ${innings.totalRuns + 1} runs.`);
      }, 2000);
    } else {
      setTimeout(async () => {
        const i1 = gameState.innings1!;
        const i2 = innings;
        let winner = '';
        if (i1.totalRuns > i2.totalRuns) winner = i1.battingTeam;
        else if (i2.totalRuns > i1.totalRuns) winner = i2.battingTeam;
        else winner = 'Match Tied';

        const summary = await generateResultSummary(i1.totalRuns, i1.wickets, i2.totalRuns, i2.wickets, winner);
        setCurrentCommentary(summary);
        setGameState(prev => ({ ...prev, stage: GameStage.Result }));
      }, 2000);
    }
  };

  const startSecondInnings = () => {
    const i1 = gameState.innings1!;
    setGameState(prev => ({
      ...prev,
      stage: GameStage.Innings2,
      innings2: createNewInnings(i1.bowlingTeam, i1.battingTeam),
    }));
    setCurrentCommentary(`${i1.bowlingTeam} begins the chase!`);
  };

  const resetGame = () => {
    setGameState({
      stage: GameStage.Toss,
      innings1: null,
      innings2: null,
      tossWinner: null,
      userDecision: null,
    });
    setCurrentCommentary("Welcome to the MCG! It's time for the toss.");
    setLastBallSummary("");
    setIsFreeHit(false);
  };

  const formatOvers = (balls: number) => {
    const overs = Math.floor(balls / BALLS_PER_OVER);
    const rem = balls % BALLS_PER_OVER;
    return `${overs}.${rem}`;
  };

  const activeInnings = gameState.stage === GameStage.Innings2 ? gameState.innings2 : gameState.innings1;
  const isUserBatting = activeInnings?.battingTeam === Team.User;

  return (
    <div className="min-h-screen bg-emerald-950 text-emerald-50 flex flex-col items-center p-4 md:p-8">
      {/* Header / Scoreboard Container */}
      <div className="w-full max-w-2xl bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-emerald-500/30 shadow-2xl mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-emerald-400">CRICKET PRO <span className="text-white">ENGINE</span></h1>
            <p className="text-xs uppercase tracking-widest text-emerald-500/80 font-semibold">T2 Simulation v3.0</p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isFreeHit ? 'bg-red-500 animate-pulse' : 'bg-emerald-800'}`}>
              {isFreeHit ? 'Free Hit!' : (gameState.stage === GameStage.Toss ? 'Pre-Match' : 'In Play')}
            </span>
          </div>
        </div>

        {/* Main Scoreboard Display */}
        {activeInnings && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-900/50 p-4 rounded-xl border border-emerald-500/20">
              <p className="text-xs text-emerald-400 font-bold uppercase mb-1">Batting: {activeInnings.battingTeam}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-digital text-white">{activeInnings.totalRuns}/{activeInnings.wickets}</span>
                <span className="text-emerald-400 font-digital text-lg">({formatOvers(activeInnings.ballsBowled)})</span>
              </div>
            </div>
            <div className="bg-emerald-900/50 p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-center">
              {gameState.stage === GameStage.Innings2 && gameState.innings1 && (
                <>
                  <p className="text-xs text-emerald-400 font-bold uppercase mb-1">Target: {gameState.innings1.totalRuns + 1}</p>
                  <p className="text-lg font-bold">Need {Math.max(0, gameState.innings1.totalRuns + 1 - activeInnings.totalRuns)} runs</p>
                  <p className="text-xs opacity-70">from {MAX_OVERS * BALLS_PER_OVER - activeInnings.ballsBowled} balls</p>
                </>
              )}
              {gameState.stage === GameStage.Innings1 && (
                <div className="flex flex-col items-center justify-center">
                   <p className="text-xs text-emerald-400 font-bold uppercase mb-1">Current Run Rate</p>
                   <p className="text-2xl font-digital">{(activeInnings.totalRuns / (activeInnings.ballsBowled / BALLS_PER_OVER || 1)).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Action Area */}
      <div className="w-full max-w-2xl flex-grow flex flex-col gap-6">
        
        {/* Commentary Box */}
        <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/10 min-h-[100px] flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
          <p className="italic text-lg text-emerald-100 px-4">"{currentCommentary}"</p>
          {lastBallSummary && (
            <span className="mt-2 text-xs font-bold bg-white text-emerald-900 px-2 py-0.5 rounded">{lastBallSummary}</span>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl">
          {gameState.stage === GameStage.Toss && !gameState.tossWinner && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold">Heads or Tails?</p>
              <div className="flex gap-4">
                <button onClick={() => handleToss('Heads')} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20">HEADS</button>
                <button onClick={() => handleToss('Tails')} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20">TAILS</button>
              </div>
            </div>
          )}

          {gameState.stage === GameStage.Toss && gameState.tossWinner === Team.User && !gameState.userDecision && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold">You won the toss! Select your play:</p>
              <div className="flex gap-4">
                <button onClick={() => startMatch('Bat')} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-emerald-200 transition-all shadow-xl">BAT FIRST</button>
                <button onClick={() => startMatch('Bowl')} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-emerald-200 transition-all shadow-xl">BOWL FIRST</button>
              </div>
            </div>
          )}

          {(gameState.stage === GameStage.Innings1 || gameState.stage === GameStage.Innings2) && activeInnings && !activeInnings.isComplete && (
            <div className="flex flex-col items-center gap-6">
              <div className="w-full flex justify-between items-center px-2">
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                  {isUserBatting ? "Select your Shot" : "Select your Delivery"}
                </p>
                <div className="h-px flex-grow mx-4 bg-emerald-500/20"></div>
                <p className="text-xs text-white/50">Targeting {isUserBatting ? 'Boundaries' : 'Wickets'}</p>
              </div>
              
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 w-full">
                {[0, 1, 2, 3, 4, 6].map(val => (
                  <button
                    key={val}
                    disabled={isProcessing}
                    onClick={() => handleAction(val)}
                    className={`h-16 flex flex-col items-center justify-center rounded-xl font-bold text-xl border-2 transition-all ${
                      isProcessing 
                        ? 'opacity-30 border-white/5 cursor-not-allowed' 
                        : 'hover:scale-105 active:scale-95 border-emerald-500/50 hover:bg-emerald-500 hover:text-black shadow-lg shadow-emerald-950'
                    }`}
                  >
                    <span className="text-2xl">{val}</span>
                    <span className="text-[10px] opacity-60 font-medium">{val === 0 ? 'DOT' : val === 4 || val === 6 ? 'SHOT' : 'RUN'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState.stage === GameStage.InningsBreak && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center mb-2">
                <h3 className="text-2xl font-bold">Innings Break</h3>
                <p className="text-emerald-400">Target: <span className="text-white text-3xl font-digital">{gameState.innings1!.totalRuns + 1}</span> runs</p>
              </div>
              <button 
                onClick={startSecondInnings} 
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl transition-all shadow-xl shadow-emerald-900/50 uppercase tracking-wider"
              >
                Start Second Innings
              </button>
            </div>
          )}

          {gameState.stage === GameStage.Result && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="p-4 bg-emerald-500 text-black rounded-2xl w-full">
                <h2 className="text-3xl font-black uppercase">Match Over</h2>
                <div className="mt-2 flex justify-center gap-8 border-t border-black/10 pt-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60">{gameState.innings1?.battingTeam}</p>
                    <p className="text-xl font-digital font-bold">{gameState.innings1?.totalRuns}/{gameState.innings1?.wickets}</p>
                  </div>
                  <div className="text-2xl font-black opacity-20 mt-2">VS</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60">{gameState.innings2?.battingTeam}</p>
                    <p className="text-xl font-digital font-bold">{gameState.innings2?.totalRuns}/{gameState.innings2?.wickets}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={resetGame} 
                className="px-12 py-4 border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black font-bold rounded-full transition-all"
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Ball History Scroll */}
        {activeInnings && activeInnings.history.length > 0 && (
          <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col h-48">
            <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase opacity-60">Ball-by-Ball Timeline</span>
              <div className="flex gap-1">
                {activeInnings.history.slice(-6).map((b, i) => (
                  <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${b.isWicket ? 'bg-red-500 text-white' : b.runs >= 4 ? 'bg-yellow-500 text-black' : 'bg-emerald-800 text-white'}`}>
                    {b.isWicket ? 'W' : b.runs}
                  </div>
                ))}
              </div>
            </div>
            <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {activeInnings.history.slice().reverse().map((ball, idx) => (
                <div key={idx} className="flex gap-4 items-start border-l-2 border-emerald-500/20 pl-4 animate-in fade-in slide-in-from-left-2">
                  <div className="min-w-[40px] text-xs font-digital text-emerald-500">{ball.over}.{ball.ballNumber}</div>
                  <div className="flex-grow">
                    <p className="text-xs text-white leading-relaxed">{ball.commentary}</p>
                    <p className="text-[10px] font-bold text-emerald-400/80 uppercase mt-0.5">
                      Result: {ball.isWicket ? 'WICKET' : ball.runs + ' Runs'} | {ball.outcomeType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-[10px] uppercase tracking-widest text-emerald-500/40 font-bold">
        Professional Cricket Engine Simulation &copy; 2024
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
