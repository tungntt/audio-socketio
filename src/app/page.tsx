'use client';

import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import Image from "next/image";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [socketEndpoint, setSocketEndpoint] = useState<string>('http://localhost:3000');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const initializeSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    try {
      socketRef.current = io(socketEndpoint);

      socketRef.current.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        setError(null);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      socketRef.current.on('audio-response', (audioData: Blob) => {
        const audioBlob = new Blob([audioData], { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      });

      socketRef.current.on('connect_error', (err: Error) => {
        console.error('Socket connection error:', err);
        setError('Failed to connect to server. Please check the endpoint.');
        setIsConnected(false);
      });
    } catch (err) {
      console.error('Error initializing socket:', err);
      setError('Failed to initialize connection');
    }
  };

  useEffect(() => {
    initializeSocket();

    const getAudioDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting audio devices:', err);
        setError('Please allow microphone access to continue');
      }
    };

    getAudioDevices();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [socketEndpoint]);

  const checkDeviceAvailability = async (deviceId: string): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  };

  const initializeAudio = async () => {
    try {
      setIsInitializing(true);
      
      await new Promise(resolve => setTimeout(resolve, 500));

      if (selectedDevice && !(await checkDeviceAvailability(selectedDevice))) {
        throw new Error('Selected device is not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: selectedDevice ? { deviceId: selectedDevice } : true
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Error recording audio. Please try again.');
        stopRecording();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      return true;
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const startRecording = async () => {
    if (isInitializing) return;
    setError(null);
    await initializeAudio();
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        setIsSending(true);
        
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);

        await new Promise(resolve => setTimeout(resolve, 200));

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        socketRef.current.emit('audio-stream', audioBlob);
        
        audioChunksRef.current = [];
      } catch (error) {
        console.error('Error sending audio:', error);
        setError('Error sending audio to server');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSocketEndpoint(e.target.value);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
              src/app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-md mb-4">
            <label htmlFor="endpoint" className="block text-sm font-medium mb-2">
              Socket.IO Endpoint
            </label>
            <div className="flex gap-2">
              <input
                id="endpoint"
                type="text"
                value={socketEndpoint}
                onChange={handleEndpointChange}
                className="flex-1 p-2 border rounded"
                placeholder="http://localhost:3000"
              />
              <button
                onClick={initializeSocket}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
              >
                Connect
              </button>
            </div>
          </div>

          <div className="text-lg">
            Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {audioDevices.length > 0 && (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="mb-4 p-2 border rounded"
              disabled={isRecording || isInitializing}
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          )}
          
          {error && (
            <div className="text-red-500 mb-4 text-center">
              {error}
            </div>
          )}
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isInitializing || isSending || !isConnected}
            className={`px-4 py-2 rounded-lg ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isInitializing ? 'Initializing...' : 
             isSending ? 'Sending...' :
             isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
