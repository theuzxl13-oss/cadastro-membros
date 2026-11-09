#!/usr/bin/env bash
# Abre o sistema no Simulador iOS (Safari) — SOMENTE macOS com Xcode.
# O projeto é web: não há app nativo, CocoaPods nem build Xcode.
#
# Uso:
#   scripts/ios-simulador.sh                 # diagnostica, sobe o servidor local e abre no iPhone
#   scripts/ios-simulador.sh print [arquivo] # salva screenshot do simulador
#   scripts/ios-simulador.sh abrir <url>     # abre outra URL (ex.: /admin/)
set -euo pipefail

URL_BASE="${URL_BASE:-http://127.0.0.1:8788}"
DISPOSITIVO="${DISPOSITIVO:-iPhone}"   # filtro pelo nome (ex.: "iPhone 16")

falha() { echo "✗ $*" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || falha "O Simulador iOS só existe no macOS."
command -v xcrun >/dev/null || falha "Instale o Xcode pela App Store e rode: sudo xcode-select -s /Applications/Xcode.app"

udid_iphone() {
  xcrun simctl list devices available -j | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8")).devices;
    const filtro = process.argv[1];
    const todos = Object.entries(d).filter(([rt]) => rt.includes("iOS")).flatMap(([, l]) => l);
    const iphone = todos.filter((x) => x.name.includes(filtro));
    const ligado = iphone.find((x) => x.state === "Booted");
    const escolhido = ligado || iphone[iphone.length - 1];
    if (!escolhido) process.exit(1);
    console.log(escolhido.udid);
  ' "$DISPOSITIVO"
}

case "${1:-iniciar}" in
  print)
    arq="${2:-test-results/simulador-$(date +%Y%m%d-%H%M%S).png}"
    mkdir -p "$(dirname "$arq")"
    xcrun simctl io booted screenshot "$arq"
    echo "✓ Screenshot: $arq"
    ;;
  abrir)
    xcrun simctl openurl booted "${URL_BASE}${2:-/}"
    ;;
  iniciar)
    echo "== Diagnóstico =="
    sw_vers
    xcodebuild -version
    xcrun simctl list runtimes | grep -i ios || falha "Nenhum runtime iOS. Xcode > Settings > Components > instale um iOS Simulator."
    node -v
    docker info >/dev/null 2>&1 || falha "Docker não está rodando (necessário para o Supabase local)."

    echo "== Supabase local =="
    npx supabase start >/dev/null
    npx supabase status

    [[ -f .env.local && -f .dev.vars ]] || falha "Crie .env.local e .dev.vars (veja README, seção 6)."

    echo "== Build e servidor =="
    npm run build
    if ! curl -fs "${URL_BASE}/api/form-config" >/dev/null; then
      nohup npx wrangler pages dev dist --port 8788 --ip 127.0.0.1 > .wrangler-dev.log 2>&1 &
      for _ in $(seq 1 60); do curl -fs "${URL_BASE}/api/form-config" >/dev/null && break; sleep 1; done
    fi
    curl -fs "${URL_BASE}/api/form-config" >/dev/null || falha "Servidor não respondeu (veja .wrangler-dev.log)."

    echo "== Simulador =="
    UDID="$(udid_iphone)" || falha "Nenhum iPhone disponível. Xcode > Window > Devices and Simulators > +"
    xcrun simctl boot "$UDID" 2>/dev/null || true
    open -a Simulator
    xcrun simctl bootstatus "$UDID" -b >/dev/null
    xcrun simctl openurl "$UDID" "${URL_BASE}/"
    echo "✓ Formulário aberto no Safari do simulador ($UDID)."
    echo "  Painel:     scripts/ios-simulador.sh abrir /admin/"
    echo "  Screenshot: scripts/ios-simulador.sh print"
    echo "  Logs JS:    Safari do Mac > Desenvolvedor > Simulator > (página)"
    ;;
  *) falha "Comando desconhecido: $1" ;;
esac
