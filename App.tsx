/**
 * @file O ponto de entrada principal da aplicação React.
 * Este componente encapsula toda a aplicação com o `ProjectProvider` para gerenciamento de estado global
 * e o `Toaster` para exibir notificações em toda a aplicação.
 */
import React from 'react';
import { Toaster } from 'react-hot-toast';
import { ProjectProvider } from './contexts/ProjectContext';
import AppContent from './AppContent';

/**
 * O componente raiz da aplicação.
 * Configura os provedores de contexto globais e o sistema de notificações.
 * @returns {React.ReactElement} O componente App.
 */
const App: React.FC = () => {
  return (
    <ProjectProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border dark:border-slate-700 shadow-lg',
          success: {
            iconTheme: {
              primary: '#16a34a',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: 'white',
            },
          },
        }}
      />
      <AppContent />
    </ProjectProvider>
  );
};

export default App;
