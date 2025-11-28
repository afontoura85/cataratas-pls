import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutTemplate, Project } from '../types';
import { CloseIcon, PlusIcon, TrashIcon, PaintBrushIcon, DocumentArrowUpIcon, StarIcon, StarSolidIcon } from './Icons';
import toast from 'react-hot-toast';

interface LayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectLayouts: LayoutTemplate[];
  onSave: (layouts: LayoutTemplate[]) => void;
  project: Project;
}

const processImageForLayout = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error('O arquivo não é uma imagem.'));
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Não foi possível obter o contexto do canvas.'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                
                // Use PNG to preserve transparency.
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};


const ReportPreview: React.FC<{ layout: LayoutTemplate | null; project: Project; }> = ({ layout, project }) => {
    if (!layout) {
        return (
             <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-md flex items-center justify-center p-4">
                <p className="text-sm text-slate-500">Selecione um layout para visualizar</p>
            </div>
        )
    }

    const containerStyle: React.CSSProperties = {
        fontFamily: layout.fontFamily || 'sans-serif',
    };
    
    const headerText = layout.headerText || project.name;
    const footerText = layout.footerText || `${project.name} - ${project.address.city || ''}, ${project.address.state || ''}`;
    const headerLogoToUse = layout.headerLogoBase64 || layout.logoBase64;

    return (
        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-md shadow-lg p-6 border dark:border-slate-700 flex flex-col" style={containerStyle}>
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b-2" style={{ borderColor: layout.primaryColor }}>
                {headerLogoToUse && <img src={headerLogoToUse} alt="header logo" className="h-6 w-auto" />}
                <p className="text-xs text-slate-700 dark:text-slate-300">{headerText}</p>
            </div>
            {/* Body */}
            <div className="flex-grow my-4 flex flex-col justify-center items-center text-center">
                 {layout.logoBase64 && <img src={layout.logoBase64} alt="cover logo" className="h-12 w-auto mx-auto mb-4" />}
                <h1 className="text-xl font-bold mb-2">{layout.name}</h1>
                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 w-full">
                    <p className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded"></p>
                    <p className="w-5/6 h-2 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></p>
                    <p className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded"></p>
                    <p className="w-3/4 h-2 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></p>
                </div>
            </div>
            {/* Footer */}
            <div className="text-center text-[8px] text-slate-400 dark:text-slate-500 border-t dark:border-slate-700 pt-2">
                {footerText}
            </div>
        </div>
    )
}


export const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({ isOpen, onClose, projectLayouts, onSave, project }) => {
    const [layouts, setLayouts] = useState<LayoutTemplate[]>([]);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const headerLogoInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#334155'];

    useEffect(() => {
        if (isOpen) {
            const initialLayouts = JSON.parse(JSON.stringify(projectLayouts || []));
            setLayouts(initialLayouts);
            if (initialLayouts.length > 0) {
                const defaultLayout = initialLayouts.find((l: LayoutTemplate) => l.isDefault) || initialLayouts[0];
                setSelectedLayoutId(defaultLayout.id);
            } else {
                setSelectedLayoutId(null);
            }
        }
    }, [isOpen, projectLayouts]);

    const selectedLayout = useMemo(() => {
        return layouts.find(l => l.id === selectedLayoutId) || null;
    }, [layouts, selectedLayoutId]);

    const handleSelectLayout = (id: string) => {
        setSelectedLayoutId(id);
    };

    const handleUpdateLayout = (field: keyof Omit<LayoutTemplate, 'id'>, value: any) => {
        if (!selectedLayoutId) return;
        setLayouts(prev => prev.map(l => l.id === selectedLayoutId ? { ...l, [field]: value } : l));
    };

    const handleAddLayout = () => {
        const hasDefault = layouts.some(l => l.isDefault);
        const newLayout: LayoutTemplate = {
            id: `layout_${Date.now()}`,
            name: `Novo Layout ${layouts.length + 1}`,
            primaryColor: '#fbbf24', // amber-400
            logoBase64: null,
            headerLogoBase64: null,
            fontFamily: 'Helvetica',
            headerText: project.name,
            footerText: `${project.name} - ${project.address.city || ''}, ${project.address.state || ''}`,
            isDefault: !hasDefault,
        };
        setLayouts(prev => [...prev, newLayout]);
        setSelectedLayoutId(newLayout.id);
    };

    const handleRemoveLayout = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este layout?')) {
            setLayouts(prev => {
                const newLayouts = prev.filter(l => l.id !== id);
                if (selectedLayoutId === id) {
                    setSelectedLayoutId(newLayouts.length > 0 ? newLayouts[0].id : null);
                }
                return newLayouts;
            });
        }
    };
    
    const handleSetAsDefault = (id: string) => {
        setLayouts(prev =>
            prev.map(l => ({
                ...l,
                isDefault: l.id === id,
            }))
        );
        toast.success('Layout definido como padrão!');
    };

    const processFile = async (file: File, target: 'logoBase64' | 'headerLogoBase64') => {
        if (file && file.type.startsWith('image/')) {
            try {
                // Set max dimensions to prevent overly large base64 strings
                const maxSize = target === 'logoBase64' ? 800 : 200;
                const base64 = await processImageForLayout(file, maxSize, maxSize);
                handleUpdateLayout(target, base64);
            } catch (error) {
                console.error("Image processing failed:", error);
                toast.error("Falha ao processar a imagem.");
            }
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'logoBase64' | 'headerLogoBase64') => {
        const file = e.target.files?.[0];
        if (file) processFile(file, target);
    };

    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        handleDragEvents(e);
        setIsDragging(true);
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        handleDragEvents(e);
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, target: 'logoBase64' | 'headerLogoBase64') => {
        handleDragEvents(e);
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file, target);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-6xl bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700">
                           <PaintBrushIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Editor de Layouts de Relatório</h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Personalize a aparência dos seus relatórios em PDF.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><CloseIcon /></button>
                </header>

                <div className="flex-grow flex overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-1/4 border-r dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800">
                        <div className="p-3">
                            <button onClick={handleAddLayout} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold shadow-sm">
                                <PlusIcon /> Novo Layout
                            </button>
                        </div>
                        <nav className="flex-grow overflow-y-auto">
                            {layouts.map(layout => (
                                <button
                                    key={layout.id}
                                    onClick={() => handleSelectLayout(layout.id)}
                                    className={`w-full text-left px-4 py-3 text-sm font-medium flex justify-between items-center ${selectedLayoutId === layout.id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        {layout.isDefault && <StarSolidIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                                        <span className="truncate">{layout.name}</span>
                                    </span>
                                    <TrashIcon onClick={(e) => { e.stopPropagation(); handleRemoveLayout(layout.id); }} className="h-4 w-4 text-slate-400 hover:text-rose-500 flex-shrink-0" />
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Main Editor */}
                    <main className="w-1/2 p-6 overflow-y-auto bg-white dark:bg-slate-800">
                        {selectedLayout ? (
                            <div className="space-y-6">
                                <fieldset>
                                    <label htmlFor="layoutName" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nome do Layout</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input id="layoutName" type="text" value={selectedLayout.name} onChange={e => handleUpdateLayout('name', e.target.value)} className="block w-full input-style" />
                                        <button
                                            type="button"
                                            onClick={() => handleSetAsDefault(selectedLayout.id)}
                                            disabled={selectedLayout.isDefault}
                                            className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            title={selectedLayout.isDefault ? "Este já é o layout padrão" : "Definir como layout padrão"}
                                        >
                                            <StarIcon className="h-5 w-5"/>
                                            Padrão
                                        </button>
                                    </div>
                                </fieldset>
                                
                                <fieldset className="space-y-4 p-4 border dark:border-slate-700 rounded-lg">
                                    <legend className="text-sm font-semibold px-2">Identidade Visual</legend>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Logo da Capa</label>
                                            <p className="text-xs text-slate-500 mt-1 mb-2">Aparecerá grande na página de rosto.</p>
                                            <input ref={logoInputRef} type="file" accept="image/png, image/jpeg" onChange={(e) => handleLogoUpload(e, 'logoBase64')} className="hidden" />
                                            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'logoBase64')} onClick={() => logoInputRef.current?.click()} className={`mt-1 h-28 w-full border-2 border-dashed dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                                                {selectedLayout.logoBase64 ? <img src={selectedLayout.logoBase64} alt="Logo preview" className="max-h-24 max-w-full" /> : <div className="text-center text-slate-500"><DocumentArrowUpIcon /><p className="text-xs mt-1">Arraste ou clique para carregar</p></div>}
                                            </div>
                                            <button onClick={() => handleUpdateLayout('logoBase64', null)} disabled={!selectedLayout.logoBase64} className="mt-2 w-full text-sm py-2 px-3 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50">Remover</button>
                                        </div>
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Logo do Cabeçalho</label>
                                            <p className="text-xs text-slate-500 mt-1 mb-2">Opcional. Usado no topo de cada página.</p>
                                            <input ref={headerLogoInputRef} type="file" accept="image/png, image/jpeg" onChange={(e) => handleLogoUpload(e, 'headerLogoBase64')} className="hidden" />
                                            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'headerLogoBase64')} onClick={() => headerLogoInputRef.current?.click()} className={`mt-1 h-28 w-full border-2 border-dashed dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                                                {selectedLayout.headerLogoBase64 ? <img src={selectedLayout.headerLogoBase64} alt="Header logo preview" className="max-h-24 max-w-full" /> : <div className="text-center text-slate-500"><DocumentArrowUpIcon /><p className="text-xs mt-1">Arraste ou clique para carregar</p></div>}
                                            </div>
                                            <button onClick={() => handleUpdateLayout('headerLogoBase64', null)} disabled={!selectedLayout.headerLogoBase64} className="mt-2 w-full text-sm py-2 px-3 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50">Remover</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Cor Principal</label>
                                        <div className="mt-1 flex items-center gap-2 p-2 border border-gray-300 dark:border-slate-600 rounded-md">
                                            <input id="primaryColor" type="color" value={selectedLayout.primaryColor} onChange={e => handleUpdateLayout('primaryColor', e.target.value)} className="h-8 w-8 p-0 border-none rounded cursor-pointer" />
                                            <input type="text" value={selectedLayout.primaryColor} onChange={e => handleUpdateLayout('primaryColor', e.target.value)} className="input-style border-none w-full !p-1" />
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {PRESET_COLORS.map(color => (
                                                <button key={color} onClick={() => handleUpdateLayout('primaryColor', color)} className="h-6 w-6 rounded-full border dark:border-slate-600 shadow-sm" style={{ backgroundColor: color }} aria-label={`Select color ${color}`} />
                                            ))}
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset className="space-y-4 p-4 border dark:border-slate-700 rounded-lg">
                                    <legend className="text-sm font-semibold px-2">Tipografia</legend>
                                    <div>
                                        <label htmlFor="fontFamily" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Fonte do Relatório</label>
                                        <select id="fontFamily" value={selectedLayout.fontFamily || 'Helvetica'} onChange={e => handleUpdateLayout('fontFamily', e.target.value)} className="mt-1 block w-full input-style">
                                            <option value="Helvetica">Helvetica (Padrão)</option>
                                            <option value="Times">Times New Roman</option>
                                            <option value="Courier">Courier</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">Escolha uma fonte segura para PDFs.</p>
                                    </div>
                                </fieldset>

                                <fieldset className="space-y-4 p-4 border dark:border-slate-700 rounded-lg">
                                    <legend className="text-sm font-semibold px-2">Conteúdo</legend>
                                    <div>
                                        <label htmlFor="headerText" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Texto do Cabeçalho</label>
                                        <input
                                            id="headerText"
                                            type="text"
                                            value={selectedLayout.headerText || ''}
                                            onChange={e => handleUpdateLayout('headerText', e.target.value)}
                                            className="mt-1 block w-full input-style"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Aparecerá no topo de cada página.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="footerText" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Texto do Rodapé</label>
                                        <input
                                            id="footerText"
                                            type="text"
                                            value={selectedLayout.footerText || ''}
                                            onChange={e => handleUpdateLayout('footerText', e.target.value)}
                                            className="mt-1 block w-full input-style"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Aparecerá na base de cada página.</p>
                                    </div>
                                </fieldset>

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <PaintBrushIcon />
                                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-slate-200">Nenhum Layout Selecionado</h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Crie um novo layout ou selecione um existente na lista.</p>
                            </div>
                        )}
                    </main>

                    {/* Preview Pane */}
                     <aside className="w-1/4 p-4">
                        <div className="aspect-[210/297] w-full">
                           <ReportPreview layout={selectedLayout} project={project} />
                        </div>
                    </aside>

                </div>

                <footer className="p-4 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 flex justify-end gap-4 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold">Cancelar</button>
                    <button onClick={() => onSave(layouts)} className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold">Salvar Layouts</button>
                </footer>
            </div>
            <style>{`.input-style { appearance: none; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid; border-color: rgb(209 213 219); background-color: white; color: rgb(17 24 39); border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); font-size: 0.875rem; line-height: 1.25rem; } .dark .input-style { border-color: rgb(71 85 105); background-color: rgb(51 65 85); color: rgb(226 232 240); } .input-style:focus { outline: none; --tw-ring-color: rgb(59 130 246); box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); border-color: rgb(59 130 246); }`}</style>
        </div>
    );
};