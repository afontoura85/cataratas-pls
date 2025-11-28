import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import * as userService from '../services/userService';
import { BuildingIcon, SpinnerIconSmall } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import toast from 'react-hot-toast';

type AuthMode = 'login' | 'register';

export const getFirebaseErrorMessage = (error: any): string => {
  // Log the full error to the console for easier debugging
  console.error("Firebase Auth Error:", error?.code, error?.message);
  
  if (!error?.code) {
    if (error instanceof Error) return error.message;
    return `Ocorreu um erro desconhecido.`;
  }

  switch (error.code) {
    case 'auth/invalid-api-key':
      return 'Chave de API inválida. Verifique a configuração do Firebase no arquivo firebase/config.ts.';
    case 'auth/operation-not-allowed':
      return 'O método de login não está habilitado. Ative o provedor (E-mail/Senha, Google) no seu console do Firebase.';
    case 'auth/invalid-email':
      return 'O formato do e-mail é inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': // Covers both incorrect email and password
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    case 'auth/popup-closed-by-user':
        return 'O pop-up de login foi fechado. Tente novamente.';
    default:
      // Provide a more informative default message including the error code
      return `Ocorreu um erro (${error.code}). Tente novamente.`;
  }
};


// Helper function to handle all authentication and profile errors consistently
const handleAuthError = (err: unknown) => {
    // Log the raw error for debugging
    console.error("Authentication or Profile Error:", err);
    toast.error(getFirebaseErrorMessage(err));
};

export const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Set persistence based on the checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await userService.createUserProfile(userCredential.user);
        // After successful registration and profile creation, a success toast can be shown.
        // The onAuthStateChanged listener will handle the redirect.
        toast.success('Cadastro realizado com sucesso!');
      } else { // Login mode
        await signInWithEmailAndPassword(auth, email, password);
        // Success toast for login can be added here if desired.
      }
    } catch (err) {
      const authError = err as any;
      // Intercept 'invalid-credential' to provide a more helpful message
      if (authError.code === 'auth/invalid-credential' && mode === 'login' && email) {
          try {
              const methods = await fetchSignInMethodsForEmail(auth, email);
              if (methods.includes(GoogleAuthProvider.PROVIDER_ID)) {
                  toast.error("Este e-mail foi usado com o login do Google. Por favor, use o botão 'Entrar com Google'.", { duration: 5000 });
              } else {
                  // It's not a Google user, so it's genuinely a wrong password or non-existent user.
                  handleAuthError(err);
              }
          } catch (fetchError) {
              // If fetching methods fails for some reason, fall back to the generic error.
              handleAuthError(err);
          }
      } else {
        // Handle other errors (registration errors, etc.) as before.
        handleAuthError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        // Set persistence based on the checkbox
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithPopup(auth, provider);
        // The onAuthStateChanged listener will handle the user state update,
        // but we ensure the profile is created immediately for a smoother experience.
        await userService.createUserProfile(result.user);
    } catch (err) {
        handleAuthError(err);
    } finally {
        setIsLoading(false);
    }
  };


  const toggleMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
      <div className="absolute top-4 right-4">
          <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <BuildingIcon />
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-4">
            PLS Cataratas
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
            {mode === 'login' ? 'Acesse sua conta para continuar.' : 'Crie uma conta para começar.'}
            </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
          <div className="space-y-6">
            <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
            >
                <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 398.2 0 256S111.8 0 244 0c73.2 0 136 29.3 182.3 75.8l-67.5 64.9C331.7 114.2 291.5 96 244 96c-82.6 0-150 67.4-150 150s67.4 150 150 150c93.2 0 128.4-69.8 133.8-106.3H244v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path></svg>
                Entrar com Google
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-slate-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                    OU
                    </span>
                </div>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div>
                <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                    Endereço de e-mail
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
                </div>

                <div>
                <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                    Senha
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
                </div>
                
                {mode === 'login' && (
                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 dark:border-slate-600 rounded"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-slate-300">
                            Manter conectado
                        </label>
                    </div>
                )}
                
                <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
                >
                    {isLoading ? <SpinnerIconSmall /> : (mode === 'login' ? 'Entrar com E-mail' : 'Cadastrar com E-mail')}
                </button>
                </div>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-slate-400">
                {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                <button
                onClick={toggleMode}
                className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 ml-1"
                >
                {mode === 'login' ? 'Cadastre-se' : 'Faça login'}
                </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
