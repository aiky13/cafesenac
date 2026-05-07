import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { DatabaseInit } from './src/database/DatabaseInit';

export default function App() {
  useEffect(() => {
    try {
      DatabaseInit();
      console.log("Banco de dados Cafeteste pronto!");
    } catch (error) {
      console.error("Erro ao iniciar o banco de dados:", error);
    }
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}