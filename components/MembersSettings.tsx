import React, { useState, useEffect, useCallback } from 'react';
import { Project, UserProfile } from '../types';
import * as userService from '../services/userService';
import * as projectService from '../services/projectService';
import { TrashIcon, SpinnerIconSmall } from './Icons';
import toast from 'react-hot-toast';

interface MembersSettingsProps {
    project: Project;
    user: UserProfile;
}

export const MembersSettings: React.FC<MembersSettingsProps> = ({ project, user }) => {
    const [members, setMembers] = useState<Map<string, UserProfile>>(new Map());
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isOwner = user.uid === project.ownerId;

    const fetchMembers = useCallback(async () => {
        setIsLoadingMembers(true);
        if (project.members && project.members.length > 0) {
            const memberProfiles = await userService.getUsersFromIds(project.members);
            setMembers(memberProfiles);
        } else {
            setMembers(new Map());
        }
        setIsLoadingMembers(false);
    }, [project.members]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers, project.id]);
    
    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!newMemberEmail.trim()) return;

        setIsAdding(true);
        try {
            const userToAdd = await userService.findUserByEmail(newMemberEmail);
            if (!userToAdd) {
                setError("Nenhum usuário encontrado com este e-mail.");
                setIsAdding(false);
                return;
            }
            if (project.members?.includes(userToAdd.uid)) {
                setError("Este usuário já é membro do projeto.");
                setIsAdding(false);
                return;
            }

            const promise = projectService.addMemberToProject(project.id, userToAdd.uid);
            await toast.promise(promise, {
                loading: 'Adicionando membro...',
                success: () => {
                    fetchMembers(); // Re-fetch after success
                    setNewMemberEmail('');
                    return 'Membro adicionado com sucesso!';
                },
                error: 'Falha ao adicionar membro.'
            });

        } catch (err) {
            console.error("Error adding member:", err);
            setError("Falha ao adicionar membro. Tente novamente.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (window.confirm(`Tem certeza que deseja remover este membro do projeto?`)) {
            const promise = projectService.removeMemberFromProject(project.id, memberId);
            toast.promise(promise, {
                loading: 'Removendo membro...',
                success: 'Membro removido com sucesso!',
                error: 'Falha ao remover membro.'
            });
        }
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-200">Membros do Projeto</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Gerencie quem tem acesso a este projeto.</p>
            </div>

            <div className="space-y-3">
                {isLoadingMembers ? (
                    <p className="text-sm text-slate-500">Carregando membros...</p>
                ) : (
                    Array.from(members.values()).map((member: UserProfile) => (
                        <div key={member.uid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-800 dark:text-slate-200">{member.email}</span>
                                {member.uid === project.ownerId && <span className="text-xs font-semibold text-amber-600 dark:text-amber-500">PROPRIETÁRIO</span>}
                            </div>
                            {isOwner && member.uid !== project.ownerId && (
                                <button onClick={() => handleRemoveMember(member.uid)} className="text-rose-500 hover:text-rose-700 p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50">
                                    <TrashIcon />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            {isOwner && (
                <form onSubmit={handleAddMember}>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-200 mt-8">Convidar Novo Membro</h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">O usuário deve ter uma conta no sistema para ser adicionado.</p>
                     <div className="flex items-start gap-3">
                        <div className="flex-grow">
                             <input
                                type="email"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                placeholder="E-mail do novo membro"
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <button type="submit" disabled={isAdding} className="flex items-center justify-center gap-2 w-32 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                            {isAdding ? <SpinnerIconSmall /> : 'Adicionar'}
                        </button>
                    </div>
                    {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
                </form>
            )}
        </div>
    );
};
