export function ligarVerSenha(raiz = document) {
  raiz.querySelectorAll('.ver-senha').forEach((b) => {
    b.addEventListener('click', () => {
      const alvo = document.getElementById(b.dataset.alvo);
      const mostrar = alvo.type === 'password';
      alvo.type = mostrar ? 'text' : 'password';
      b.textContent = mostrar ? 'Ocultar' : 'Mostrar';
      b.setAttribute('aria-pressed', String(mostrar));
      b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}

export function senhaForte(s) {
  if (s.length < 10) return 'A senha deve ter pelo menos 10 caracteres.';
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
  return '';
}
