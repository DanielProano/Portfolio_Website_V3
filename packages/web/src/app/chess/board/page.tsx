'use client';

import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useRef, useState, useEffect } from 'react';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { Box, TextField, Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { IconButton } from '@mui/material';
import init, { make_move } from '../engine/pkg';

export default function ChessPage() {
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;
    const [chessPosition, setChessPosition] = useState(chessGame.fen());
    const [orientation, setOrientation] = useState<'white' | 'black'>('white');
    const [engineReady, setEngineReady] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    useEffect(() => {
        init().then(() => setEngineReady(true));
    }, []);

    // Trigger the bot's first move if the user starts the game as Black
    useEffect(() => {
        if (gameStarted && orientation === 'black' && engineReady) {
            // Ensure it's white's turn before making the move
            if (chessGame.turn() === 'w') {
                const bestMove = make_move(chessGame.fen(), 6);
                if (bestMove) {
                    chessGame.load(bestMove);
                    setChessPosition(bestMove);
                }
            }
        }
    }, [gameStarted, orientation, engineReady]);

    function handleStartGame() {
        setGameStarted(true);
    }

    function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
        // Prevent moves if the game hasn't officially started yet
        if (!gameStarted || !targetSquare) return false;

        try {
            chessGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
            setChessPosition(chessGame.fen());

            if (engineReady) {
                const bestMove = make_move(chessGame.fen(), 5);
                if (bestMove) {
                    console.log(bestMove);
                    chessGame.load(bestMove);
                    setChessPosition(bestMove);
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    function handleFenChange(e: React.ChangeEvent<HTMLInputElement>) {
        const fen = e.target.value;
        try {
            chessGame.load(fen);
            setChessPosition(fen);
        } catch {
            setChessPosition(fen);
        }
    }

    const boardOptions = {
        position: chessPosition,
        onPieceDrop,
        boardOrientation: orientation,
    };

    return (
        <Box sx={{
            width: 'min(600px, 90vw)',
            mx: 'auto',
            mt: 6,
        }}>
            <Box sx={{
                backgroundColor: '#3c475c',
                border: '2px solid #3c4e77',
                borderRadius: 4,
                p: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                position: 'relative', // Context for the absolute overlay
            }}>
                <Chessboard options={boardOptions} />

                {/* Play Overlay */}
                {!gameStarted && (
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: 4,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10,
                    }}>
                        <Button
                            variant="contained"
                            color="success"
                            size="large"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleStartGame}
                            disabled={!engineReady}
                            sx={{
                                fontSize: '1.5rem',
                                padding: '12px 36px',
                                borderRadius: '50px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                            }}
                        >
                            {engineReady ? 'Play' : 'Loading Engine...'}
                        </Button>
                    </Box>
                )}
            </Box>
            
            <TextField 
                label="FEN:"
                value={chessPosition}
                onChange={handleFenChange}
                disabled={!gameStarted} // Keeps FEN locked until game starts
                sx={{
                    mt: 2,
                    input: { color: '#fff', fontSize: '0.8rem' },
                    width: { xs: '200px', md: '415px' },
                    backgroundColor: '#3c475c',
                    borderRadius: 4,
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 4,
                        '& fieldset': { borderColor: '#3c4e77' },
                    },
                    '& .MuiInputLabel-root': { color: '#87a6ed' },
                }} 
            />
            <IconButton
                onClick={() => setOrientation(prev => prev === 'white' ? 'black' : 'white')}
                disabled={gameStarted}
                sx={{ 
                    color: '#87a6ed', 
                    padding: 2, 
                    ml: 2,
                    '&.Mui-disabled': { color: '#556585' }
                }}
            >
                <SwapVertIcon sx={{ fontSize: '3.5rem' }} />
            </IconButton>
        </Box>
    );
}