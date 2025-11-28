import React, { useState, useMemo } from 'react';
import { analyzeImage, getComplexAdvice, getGroundedResearch, extractTextFromImage } from '../services/geminiService';
import { AssistantView, ProgressMatrix, ServiceCategory } from '../types';
import { CameraIcon, BrainIcon, SearchIcon, DocumentTextIcon, CloseIcon } from './Icons';
import { GroundingChunk } from '@google/genai';

interface GeminiAssistantProps {
    currentView: AssistantView;
    setCurrentView: (view: AssistantView) => void;
    plsData: ServiceCategory[];
    progress: ProgressMatrix;
    onClose: () => void;
}

const AssistantTab:React.FC<{title: string, icon: React.ReactNode, isActive: boolean, onClick: () => void}> = ({ title, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium border-b-2 transition-colors ${
            isActive ? 'border-amber-500 text-amber-600 dark:border-amber-500 dark:text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
    >
        {icon}
        {title}
    </button>
)

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ currentView, setCurrentView, plsData, progress, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [query, setQuery] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const serviceItems = useMemo(() => plsData.flatMap(cat => cat.subItems.map(item => ({id: item.id, name: item.name}))), [plsData]);
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setResponse(null);
        setSources([]);

        try {
            if (currentView === 'image' && image) {
                const result = await analyzeImage(image, serviceItems);
                setResponse(result);
            } else if (currentView === 'ocr' && image) {
                const result = await extractTextFromImage(image, query);
                setResponse(result);
            } else if (currentView === 'advisor' && query) {
                const result = await getComplexAdvice(plsData, progress, query);
                setResponse(result);
            } else if (currentView === 'research' && query) {
                const { text, sources } = await getGroundedResearch(query);
                setResponse(text);
                setSources(sources);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const resetState = () => {
      setQuery('');
      setResponse(null);
      setImage(null);
      setImagePreview(null);
      setSources([]);
    }

    const renderContent = () => {
        switch (currentView) {
            case 'image':
                return (
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Envie uma foto da obra para que a IA sugira o andamento dos serviços.</p>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 dark:file:bg-amber-900/50 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-amber-100 dark:hover:file:bg-amber-800/50"/>
                        {imagePreview && <img src={imagePreview} alt="Preview" className="mt-4 rounded-lg max-h-40 w-auto mx-auto shadow-md" />}
                    </div>
                );
            case 'ocr':
                return (
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Envie um documento (nota fiscal, medição, etc.) e a IA irá extrair o texto.</p>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 dark:file:bg-amber-900/50 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-amber-100 dark:hover:file:bg-amber-800/50 mb-3"/>
                        {imagePreview && <img src={imagePreview} alt="Preview" className="mb-4 rounded-lg max-h-40 w-auto mx-auto shadow-md" />}
                        <textarea 
                            value={query} 
                            onChange={(e) => setQuery(e.target.value)} 
                            placeholder="Instruções (opcional). Ex: 'Extraia o valor total e a data'." 
                            className="w-full p-2 border dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-slate-200 h-20 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                );
            case 'advisor':
                 return (
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Faça uma pergunta complexa sobre o projeto. A IA usará o modo de Raciocínio Avançado.</p>
                        <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: Qual o caminho crítico para o próximo mês para maximizar a liberação de recursos?" className="w-full p-2 border dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-slate-200 h-24 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"/>
                    </div>
                )
            case 'research':
                return (
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Pesquise informações atualizadas sobre normas, custos ou materiais.</p>
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: Normas ABNT para impermeabilização..." className="w-full p-2 border dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"/>
                    </div>
                )
        }
    }

    const isSubmitDisabled = isLoading || 
        (currentView === 'image' && !image) || 
        (currentView === 'ocr' && !image) ||
        (currentView === 'advisor' && !query) ||
        (currentView === 'research' && !query);

    return (
        <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-40 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b dark:border-slate-700 flex-shrink-0">
                <h2 className="text-xl font-bold dark:text-slate-100">Assistente Gemini</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400" aria-label="Fechar assistente">
                    <CloseIcon />
                </button>
            </header>
            <div className="flex-grow p-6 overflow-y-auto">
                <div className="border-b border-slate-200 dark:border-slate-700 mb-4">
                    <div className="flex -mb-px">
                       <AssistantTab title="Análise" icon={<CameraIcon />} isActive={currentView === 'image'} onClick={() => { setCurrentView('image'); resetState(); }} />
                       <AssistantTab title="OCR" icon={<DocumentTextIcon />} isActive={currentView === 'ocr'} onClick={() => { setCurrentView('ocr'); resetState(); }}/>
                       <AssistantTab title="Consultor" icon={<BrainIcon />} isActive={currentView === 'advisor'} onClick={() => { setCurrentView('advisor'); resetState(); }}/>
                       <AssistantTab title="Pesquisa" icon={<SearchIcon />} isActive={currentView === 'research'} onClick={() => { setCurrentView('research'); resetState(); }}/>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="min-h-[220px]">
                        {renderContent()}
                    </div>
                    
                    <button type="submit" disabled={isSubmitDisabled} className="w-full mt-4 py-2 px-4 bg-amber-500 text-white rounded-md font-semibold hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                        {isLoading ? 'Analisando...' : 'Enviar para Gemini'}
                    </button>
                </form>

                {response && (
                    <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                        <h3 className="font-bold mb-2 dark:text-slate-200">Resposta da IA:</h3>
                        <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{response}</p>
                        {sources.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-xs text-slate-600 dark:text-slate-400">Fontes:</h4>
                                <ul className="list-disc list-inside text-xs mt-1">
                                    {sources.map((source, index) => (
                                        <li key={index}>
                                            <a href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">{source.web?.title}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};