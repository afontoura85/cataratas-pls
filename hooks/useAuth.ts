/**
 * @file Hook personalizado para gerenciar e fornecer o estado de autenticação do usuário.
 */
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import * as userService from '../services/userService';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

/**
 * Hook `useAuth` que monitora o estado de autenticação do Firebase em tempo real.
 * Ele gerencia o perfil do usuário, garante que um perfil correspondente exista no Firestore
 * e fornece um sinalizador de inicialização para aguardar a primeira verificação de autenticação.
 *
 * @returns {{
 *   user: UserProfile | null;
 *   isInitializing: boolean;
 * }} Um objeto contendo o perfil do usuário (ou nulo se não estiver logado) e um booleano
 * que é verdadeiro enquanto o estado de autenticação inicial está sendo determinado.
 */
export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // onAuthStateChanged retorna uma função de cancelamento de inscrição
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Lógica de fallback para garantir que um perfil de usuário sempre exista,
        // especialmente útil para logins sociais ou casos de borda.
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          // Cria o perfil no Firestore se ele não existir
          await userService.createUserProfile(currentUser);
        }
        // Armazena um objeto simples e serializável no estado em vez do objeto complexo do Firebase User.
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
        });
      } else {
        // Nenhum usuário está logado
        setUser(null);
      }
      // Após a primeira verificação, a inicialização está completa.
      if (isInitializing) {
        setIsInitializing(false);
      }
    });
    // Limpa a inscrição no desmontar do componente para evitar vazamentos de memória
    return () => unsubscribe();
  }, [isInitializing]);

  return { user, isInitializing };
}
