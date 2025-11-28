import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { CloseIcon, MicrophoneIcon, SpinnerIconSmall } from './Icons';
import toast from 'react-hot-toast';

// Audio helper functions as per guidelines
// Base64 encode
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 decode
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Custom PCM audio decoder
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// Create a Blob for the API
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Component Props
interface LiveAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  // We can pass project data here in the future to give context to the AI
}

type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export const LiveAssistantModal: React.FC<LiveAssistantModalProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<ConversationStatus>('idle');
    const [transcription, setTranscription] = useState<{ user: string; model: string }[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    
    // Using refs to hold onto objects that shouldn't trigger re-renders
    const sessionRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const isClosingRef = useRef(false);

    const startConversation = async () => {
        if (status !== 'idle' && status !== 'error') return;
        isClosingRef.current = false;

        setStatus('connecting');
        setTranscription([]);
        setCurrentInput('');
        setCurrentOutput('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (isClosingRef.current) { // Check if user closed modal while waiting for permission
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            mediaStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            // Output audio context for playing model's response
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();

            sessionRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.debug('Live session opened.');
                        setStatus('listening');
                        
                        // Input audio context for capturing user's voice
                        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        audioContextRef.current = inputAudioContext;
                        
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            setStatus('speaking');
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            
                            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                            
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(source);
                            source.addEventListener('ended', () => {
                                sources.delete(source);
                                if (sources.size === 0) {
                                    setStatus('listening');
                                }
                            });
                        }
                        
                        if (message.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
                        }

                        if (message.serverContent?.turnComplete) {
                            setTranscription(prev => [...prev, { user: currentInput, model: currentOutput }]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setStatus('error');
                        toast.error('Erro na conexão com a IA. Tente novamente.');
                        stopConversation();
                    },
                    onclose: (e: CloseEvent) => {
                        console.debug('Live session closed.');
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'Você é um assistente de engenharia civil para o sistema PLS Cataratas. Responda de forma concisa e direta sobre o andamento da obra. Você pode receber perguntas sobre o progresso, finanças e itens da planilha. Seja prestativo e profissional.',
                },
            });

        } catch (error) {
            console.error("Failed to start conversation:", error);
            setStatus('error');
            toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
        }
    };
    
    const stopConversation = () => {
        isClosingRef.current = true;
        sessionRef.current?.then(session => session.close());
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        // Check if context is running before closing to avoid errors
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
           audioContextRef.current.close();
        }

        sessionRef.current = null;
        mediaStreamRef.current = null;
        audioContextRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        
        setStatus('idle');
    };

    const handleClose = () => {
        stopConversation();
        onClose();
    };

    const getStatusText = () => {
        switch (status) {
            case 'idle': return 'Clique no microfone para começar';
            case 'connecting': return 'Conectando com o assistente...';
            case 'listening': return 'Ouvindo...';
            case 'speaking': return 'Assistente respondendo...';
            case 'error': return 'Ocorreu um erro. Tente novamente.';
            default: return '';
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleClose}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                        Assistente de Voz
                    </h2>
                     <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="flex-grow p-6 overflow-y-auto min-h-[200px]">
                    {transcription.map((turn, index) => (
                        <div key={index} className="mb-4 space-y-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400"><strong>Você:</strong> {turn.user}</p>
                            <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Assistente:</strong> {turn.model}</p>
                        </div>
                    ))}
                    {currentInput && <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse"><strong>Você:</strong> {currentInput}...</p>}
                    {currentOutput && <p className="text-sm text-slate-800 dark:text-slate-200 animate-pulse"><strong>Assistente:</strong> {currentOutput}...</p>}
                </main>

                <footer className="p-6 border-t dark:border-slate-700 flex flex-col items-center justify-center">
                    <button 
                        onClick={status === 'idle' || status === 'error' ? startConversation : stopConversation}
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-colors duration-300
                            ${status === 'listening' ? 'bg-emerald-500 animate-pulse' : ''}
                            ${status === 'speaking' ? 'bg-sky-500' : ''}
                            ${status === 'connecting' ? 'bg-amber-500' : ''}
                            ${status === 'error' ? 'bg-rose-500' : ''}
                            ${status === 'idle' ? 'bg-slate-500 hover:bg-slate-600' : ''}
                        `}
                        aria-label={status === 'idle' || status === 'error' ? 'Start conversation' : 'Stop conversation'}
                    >
                        {status === 'connecting' ? <SpinnerIconSmall /> : <MicrophoneIcon className="w-10 h-10" />}
                    </button>
                    <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300 min-h-[20px]">
                        {getStatusText()}
                    </p>
                </footer>
            </div>
        </div>
    );
};
