const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('audio-stream', (audioData) => {
      try {
        // Generate unique filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `audio_${timestamp}.webm`;
        const filepath = path.join(uploadsDir, filename);

        
        // Save the audio data to a file
        // fs.writeFile(filepath, audioData, (err) => {
        //   if (err) {
        //     console.error('Error saving audio file:', err);
        //   } else {
        //     console.log('Audio saved to:', filepath);
        //   }
        // });

        // Log audio data details
        console.log('Received audio data:', {
          size: audioData.length,
          type: typeof audioData,
          timestamp: new Date().toISOString()
        });

        // Echo back the audio data
        socket.emit('audio-response', audioData);
      } catch (error) {
        console.error('Error processing audio data:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
}); 