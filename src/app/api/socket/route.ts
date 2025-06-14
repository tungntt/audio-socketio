import { Server } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';

type SocketResponse = NextApiResponse & {
  socket: {
    server: HTTPServer & {
      io?: Server;
    };
  };
};

const ioHandler = (req: NextApiRequest, res: SocketResponse) => {
  if (!res.socket?.server) {
    res.end();
    return;
  }

  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('Client connected');

      socket.on('audio-stream', (audioData) => {
        // Process the received audio data
        console.log('Route received audio data');
        
        // Echo back the audio data (you can modify this to process the audio)
        socket.emit('audio-response', audioData);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  }

  res.end();
};

export const GET = ioHandler;
export const POST = ioHandler; 