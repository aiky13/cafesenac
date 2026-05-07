import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import Login from '../screens/Login';
import Cadastro from '../screens/Cadastro';
import Home from '../screens/Home';
import DetalhesProduto from '../screens/DetalhesProduto';
import Carrinho from '../screens/Carrinho';
import Checkout from '../screens/Checkout';
import Perfil from '../screens/Perfil';
import MeusPedidos from '../screens/MeusPedidos';
import Favoritos from '../screens/Favoritos';
import Sobre from '../screens/Sobre';
import GerenciarEnderecos from '../screens/GerenciarEnderecos';
import DadosPessoais from '../screens/DadosPessoais';
import Admin from '../screens/Admin';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Cadastro" component={Cadastro} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Detalhes" component={DetalhesProduto} />
      <Stack.Screen name="Carrinho" component={Carrinho} />
      <Stack.Screen name="Checkout" component={Checkout} />
      <Stack.Screen name="Perfil" component={Perfil} />
      <Stack.Screen name="MeusPedidos" component={MeusPedidos} />
      <Stack.Screen name="Favoritos" component={Favoritos} />
      <Stack.Screen name="Sobre" component={Sobre} />
      <Stack.Screen name="GerenciarEnderecos" component={GerenciarEnderecos} />
      <Stack.Screen name="DadosPessoais" component={DadosPessoais} />
      <Stack.Screen name="Admin" component={Admin} />
    </Stack.Navigator>
  );
}