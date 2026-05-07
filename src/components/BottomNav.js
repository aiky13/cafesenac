import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { C, S } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function BottomNav({ navigation, active, user }) {
  const tabs = [
    { name: 'Home',        icon: 'home',     iconOut: 'home-outline',   label: 'Início' },
    { name: 'Favoritos',   icon: 'heart',    iconOut: 'heart-outline',  label: 'Favoritos' },
    { name: 'Carrinho',    icon: 'cart',     iconOut: 'cart-outline',   label: 'Carrinho' },
    { name: 'MeusPedidos', icon: 'time',     iconOut: 'time-outline',   label: 'Status' },
    { name: 'Perfil',      icon: 'person',   iconOut: 'person-outline', label: 'Perfil' },
  ];

  return (
    <View style={styles.navbar}>
      {tabs.map(tab => {
        const isActive = active === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.navItem}
            onPress={() => {
              if (isActive) return;
              navigation.navigate(tab.name, { user });
            }}
          >
            <Ionicons
              name={isActive ? tab.icon : tab.iconOut}
              size={24}
              color={isActive ? '#6F4E37' : '#999'}
            />
            <Text style={[styles.navText, isActive && styles.navTextActive]}>
              {tab.label}
            </Text>

          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    borderTopWidth: 1, borderColor: C.foam,
    backgroundColor: C.white,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    height: Platform.OS === 'ios' ? 82 : 68,
    elevation: 12,
    shadowColor: C.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navText: { fontSize: 10, color: C.textMuted, marginTop: 3, fontWeight: '500' },
  navTextActive: { color: C.cafe, fontWeight: 'bold' },
  activeIndicator: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: C.cafe, marginTop: 2,
  },
});