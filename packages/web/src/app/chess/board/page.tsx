'use client';

import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useRef, useState, useEffect } from 'react';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { Box, TextField } from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { IconButton } from '@mui/material';

export default function ChessPage() {
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;
    const [chessPosition, setChessPosition] = useState(chessGame.fen());
    const [orientation, setOrientation] = useState<'white' | 'black'>('white');
    const [engineReady, setEngineReady] = useState(false);

    useEffect(() => {
        init().then(() => setEngineReady(true));
    }, []);

    function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
        if (!targetSquare) return false;

        try {
            chessGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
            setChessPosition(chessGame.fen());

            if (engineReady) {
                const bestMove = make_move(chessGame.fen(), 3);
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
            }}>
                <Chessboard options={boardOptions} />
            </Box>
            <TextField 
                label="FEN:"
                value={chessPosition}
                onChange={handleFenChange}
                sx={{
                    mt: 2,
                    input: { color: '#fff', fontSize: '0.8rem' },
                    width: '415px',
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
                sx={{ color: '#87a6ed', padding: 2, ml: 2 }}
            >
                <SwapVertIcon sx={{ fontSize: '3.5rem' }} />
            </IconButton>
        </Box>
    );
}