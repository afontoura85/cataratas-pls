import React, { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from './Icons';

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState(() => 
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
      // Sincroniza com a preferência do sistema operacional na montagem
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
          const newTheme = mediaQuery.matches ? 'dark' : 'light';
          setTheme(newTheme);
          document.documentElement.classList.toggle('dark', mediaQuery.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      // Sincronização inicial
      handleChange();
      return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => {
        const newTheme = prevTheme === 'light' ? 'dark' : 'light';
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return newTheme;
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
};