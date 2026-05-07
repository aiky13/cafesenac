// ═══════════════════════════════════════════════════════════════
//  theme.js  —  Café Senac  •  Paleta extraída da logo
//  Marrom escuro vinho (#5C1A1A) + creme (#F5EFE6) + dourado
// ═══════════════════════════════════════════════════════════════

export const C = {
  // ── Primários (logo) ──────────────────────────────────────────
  espresso:     '#4A1010',   // marrom vinho escuro (borda da logo)
  cafe:         '#6B2020',   // marrom médio (principal)
  caramel:      '#8B3A3A',   // marrom mais claro
  latte:        '#C49A9A',   // rosado acinzentado
  foam:         '#E8D5D5',   // rosa muito claro / borda
  cream:        '#F7F0EC',   // fundo creme quente
  milk:         '#FDF8F5',   // branco marfim
  white:        '#FFFFFF',

  // ── Acentos ──────────────────────────────────────────────────
  gold:         '#C9A84C',   // dourado para estrelas / destaques
  goldLight:    '#F5E6B2',   // dourado claro
  verde:        '#2D7A4F',   // verde para preços / sucesso
  verdeClaro:   '#E6F4ED',   // fundo verde claro
  vermelho:     '#C0392B',
  vermelhoClaro:'#FDECEA',
  amarelo:      '#E67E22',
  azul:         '#2471A3',

  // ── Texto ─────────────────────────────────────────────────────
  textDark:     '#1A0808',   // quase preto vinho
  textMid:      '#4A2525',
  textLight:    '#8B5E5E',
  textMuted:    '#B08888',
};

export const S = {
  cardShadow: {
    shadowColor: '#4A1010',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  strongShadow: {
    shadowColor: '#1A0808',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 10,
  },
  // Gradiente simulado (para uso em View com borderRadius)
  gradientBg: {
    backgroundColor: '#4A1010',
  },
};

export default { C, S };