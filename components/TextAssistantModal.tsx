import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type, Content } from '@google/genai';
import { Project, ServiceCategory, Financials, AssistantProgressUpdate } from '../types';
import { CloseIcon, SparklesIcon, SpinnerIconSmall, MicrophoneIcon } from './Icons';
import toast from 'react-hot-toast';

// Add type declarations for Web Speech API to fix SpeechRecognition errors.
// These are necessary because the Web Speech API is not yet a W3C standard
// and TypeScript does not include its types by default.
interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    start(): void;
    stop(): void;
}

interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionStatic;
        webkitSpeechRecognition: SpeechRecognitionStatic;
    }
}

interface TextAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    plsData: ServiceCategory[];
    financials: Financials;
    onUpdateProgressFromAssistant: (updates: AssistantProgressUpdate[]) => string;
}

interface Message {
    role: 'user' | 'model';
    content: string;
}

const updateProgressFunctionDeclaration: FunctionDeclaration = {
    name: 'updateProgress',
    description: 'Atualiza o progresso (0-100%) de um ou mais serviços de construção para uma ou mais unidades habitacionais. Use o valor "all" no array unitNames para aplicar a todas as unidades.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            updates: {
                type: Type.ARRAY,
                description: 'Uma lista de atualizações de progresso a serem aplicadas.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        serviceName: {
                            type: Type.STRING,
                            description: 'O nome exato do serviço a ser atualizado (ex: "Alvenaria / fechamentos").',
                        },
                        unitNames: {
                            type: Type.ARRAY,
                            description: 'Uma lista dos nomes exatos das unidades a serem atualizadas (ex: ["Casa 01", "Casa 02"]) ou um array com a única string "all" para todas as unidades.',
                            items: {
                                type: Type.STRING,
                            },
                        },
                        progress: {
                            type: Type.NUMBER,
                            description: 'O novo percentual de progresso (de 0 a 100).',
                        },
                    },
                    required: ['serviceName', 'unitNames', 'progress'],
                },
            },
        },
        required: ['updates'],
    },
};

export const TextAssistantModal: React.FC<TextAssistantModalProps> = ({ isOpen, onClose, project, plsData, financials, onUpdateProgressFromAssistant }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const [history, setHistory] = useState<Content[]>([]);
    const aiRef = useRef<GoogleGenAI | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const systemInstruction = useMemo(() => {
        const context = {
            projectName: project.name,
            costOfWorks: project.cost_of_works,
            unitCount: project.housing_units.length,
            unitNames: project.housing_units.map(u => u.name),
            financials: {
                totalProgress: financials.totalProgress,
                totalReleased: financials.totalReleased,
                balanceToMeasure: financials.balanceToMeasure,
            },
            serviceCategories: plsData.map(c => ({
                categoryName: c.name,
                items: c.subItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    incidence: item.incidence,
                }))
            }))
        };
        return `Você é um assistente especialista em engenharia civil para o sistema PLS Cataratas. Sua função é analisar os dados do projeto e responder às perguntas do usuário. Você também pode ATUALIZAR o progresso dos serviços usando a ferramenta 'updateProgress'. Antes de chamar a função, sempre confirme a ação com o usuário. Após a execução, informe o resultado. Os dados do projeto, incluindo os nomes dos serviços e das unidades, estão no contexto abaixo. Use-os para preencher os argumentos da função.\n\nCONTEXTO DO PROJETO:\n${JSON.stringify(context, null, 2)}`;
    }, [project, plsData, financials]);

    useEffect(() => {
        if (isOpen) {
            try {
                aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY! });
                setHistory([]);
                setMessages([]);
                setInput('');
            } catch (error) {
                console.error("Failed to initialize Gemini:", error);
                toast.error("Não foi possível iniciar o assistente de texto.");
                onClose();
            }
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        }
        // Cleanup on close
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                setIsRecording(false);
            }
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !aiRef.current) return;

        const userMessageContent = input;
        setMessages(prev => [...prev, { role: 'user', content: userMessageContent }]);
        setInput('');
        setIsLoading(true);

        const ai = aiRef.current;
        const userMessagePart: Content = { role: 'user', parts: [{ text: userMessageContent }] };
        const currentHistory = [...history, userMessagePart];

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: currentHistory,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: [updateProgressFunctionDeclaration] }],
                },
            });

            const modelResponseContent = response.candidates![0].content;
            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                const fc = functionCalls[0];
                let functionResultText: string;

                if (fc.name === 'updateProgress') {
                    const updates = fc.args.updates as AssistantProgressUpdate[] | undefined;
                    if (!updates || !Array.isArray(updates)) {
                        throw new Error("O modelo retornou argumentos inválidos para a função updateProgress.");
                    }
                    functionResultText = onUpdateProgressFromAssistant(updates);
                } else {
                    functionResultText = `Função desconhecida chamada: ${fc.name}`;
                }

                const toolResponsePart: Content = {
                    role: 'tool',
                    parts: [{
                        functionResponse: {
                            name: fc.name,
                            response: { result: functionResultText },
                        },
                    }],
                };

                const historyWithToolResponse = [...currentHistory, modelResponseContent, toolResponsePart];

                const finalResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: historyWithToolResponse,
                    config: {
                        systemInstruction,
                        tools: [{ functionDeclarations: [updateProgressFunctionDeclaration] }],
                    },
                });

                const finalModelResponseContent = finalResponse.candidates![0].content;
                setMessages(prev => [...prev, { role: 'model', content: finalResponse.text }]);
                setHistory([...historyWithToolResponse, finalModelResponseContent]);

            } else {
                setMessages(prev => [...prev, { role: 'model', content: response.text }]);
                setHistory([...currentHistory, modelResponseContent]);
            }
        } catch (error) {
            console.error("Gemini chat error:", error);
            let errorMessage = "Desculpe, ocorreu um erro ao processar sua solicitação.";
            if (error instanceof Error) {
                errorMessage += ` Detalhes: ${error.message}`;
            }
            setMessages(prev => [...prev, { role: 'model', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Seu navegador não suporta a transcrição de áudio.");
            return;
        }

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'pt-BR';
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onstart = () => {
            setIsRecording(true);
        };

        recognitionRef.current.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            toast.error(`Erro de gravação: ${event.error}`);
        };

        recognitionRef.current.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            setInput(transcript);
        };

        recognitionRef.current.start();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e as any);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <SparklesIcon />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                            Assistente de Texto
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="flex-grow p-4 overflow-y-auto min-h-[300px] space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.role === 'user'
                                ? 'bg-blue-500 text-white rounded-br-lg'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-lg'}`
                            }>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                        <div className="flex justify-start">
                            <div className="max-w-xs p-3 rounded-2xl bg-slate-200 dark:bg-slate-700 rounded-bl-lg">
                                <SpinnerIconSmall />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 border-t dark:border-slate-700">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pergunte ou peça para atualizar um progresso..."
                            rows={1}
                            className="flex-grow resize-none p-2 border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={handleToggleRecording}
                            className={`p-2 rounded-full transition-colors ${isRecording
                                    ? 'bg-red-500/20 text-red-500 animate-pulse'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                            aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
                        >
                            <MicrophoneIcon />
                        </button>
                        <button type="submit" disabled={isLoading || !input.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed">
                            Enviar
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};
