import React, { useState, useMemo } from 'react';
import { ProgressLog } from '../types';
import { CloseIcon, HistoryIcon, SearchIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';

interface HistoryModalProps {
  history: ProgressLog[];
  onClose: () => void;
}

const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

export const HistoryModal: React.FC<HistoryModalProps> = ({ history, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredHistory = useMemo(() => {
        if (!searchTerm.trim()) {
            return history;
        }
        const lowercasedQuery = searchTerm.toLowerCase();
        return history.filter(log => 
            log.itemName.toLowerCase().includes(lowercasedQuery) ||
            log.unitName.toLowerCase().includes(lowercasedQuery)
        );
    }, [history, searchTerm]);

    const groupedHistory = useMemo(() => {
        const groups: { [date: string]: ProgressLog[] } = {};
        filteredHistory.forEach(log => {
            const date = log.timestamp.split('T')[0];
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(log);
        });
        return groups;
    }, [filteredHistory]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700">
                           <HistoryIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                                Histórico de Alterações do Projeto
                            </h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                                Veja todas as mudanças de progresso registradas.
                            </p>
                        </div>
                    </div>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <div className="p-4 border-b dark:border-slate-700">
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por serviço ou unidade..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-700/80 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-blue-500 rounded-md transition-colors"
                        />
                    </div>
                </div>

                <main className="flex-grow p-4 overflow-y-auto">
                    {Object.keys(groupedHistory).length > 0 ? (
                        <div className="space-y-6">
                            {Object.entries(groupedHistory).map(([date, logs]) => (
                                <div key={date}>
                                    <h3 className="font-semibold text-slate-600 dark:text-slate-300 pb-2 mb-2 border-b dark:border-slate-700">
                                        {formatDateHeader(date)}
                                    </h3>
                                    <ul className="space-y-3">
                                        {(logs as ProgressLog[]).map(log => {
                                            const isIncrease = log.newProgress > log.oldProgress;
                                            return (
                                                <li key={log.id} className="flex items-start gap-3">
                                                    <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isIncrease ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'}`}>
                                                        {isIncrease ? <ArrowUpIcon /> : <ArrowDownIcon />}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <p className="text-sm text-slate-800 dark:text-slate-200">
                                                            O progresso de <strong>{log.itemName}</strong> na <strong>{log.unitName}</strong> foi alterado de {' '}
                                                            <span className="font-semibold text-rose-600 dark:text-rose-400">{log.oldProgress}%</span> para {' '}
                                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{log.newProgress}%</span>.
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-16">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">
                                {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum histórico de alterações encontrado'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {searchTerm ? 'Tente ajustar sua busca.' : 'As alterações de progresso aparecerão aqui.'}
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
