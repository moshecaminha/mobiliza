#!/usr/bin/env bash
# ============================================================
# MOBILIZA · Setup Git para Linux/Mac
# ============================================================
# Inicializa repositório Git local pronto para push ao GitHub.
# Rode: chmod +x setup-git.sh && ./setup-git.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "============================================================"
echo "  MOBILIZA · Setup Git"
echo "============================================================"
echo ""

# Verifica git
if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}[ERRO]${NC} Git não encontrado."
  echo "Instale: sudo apt install git  (Linux)  ou  brew install git  (Mac)"
  exit 1
fi
git --version
echo ""

# Init se necessário
if [ -d .git ]; then
  echo -e "${YELLOW}[INFO]${NC} Repositório Git já existe nesta pasta."
else
  echo "Inicializando repositório..."
  git init
  git branch -M main
fi
echo ""

# Cria .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}[OK]${NC} .env criado a partir de .env.example"
  echo -e "${YELLOW}[AVISO]${NC} Edite o .env antes de fazer deploy real!"
  echo ""
fi

# Garante .env no .gitignore
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo ".env" >> .gitignore
  echo -e "${GREEN}[OK]${NC} .env adicionado ao .gitignore"
fi

# Stage
echo "Adicionando arquivos..."
git add .
git status --short
echo ""

# Commit
read -p "Mensagem do commit [Initial commit · MOBILIZA platform]: " MSG
MSG=${MSG:-"Initial commit · MOBILIZA platform"}

if git diff --cached --quiet; then
  echo -e "${YELLOW}[INFO]${NC} Nada novo para commitar"
else
  git commit -m "$MSG"
  echo -e "${GREEN}[OK]${NC} Commit criado"
fi
echo ""

echo "============================================================"
echo "  Repositório local pronto!"
echo "============================================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Crie um repo no GitHub:"
echo "   https://github.com/new"
echo "   Nome sugerido: mobiliza-backend"
echo "   ${YELLOW}Marque como Privado${NC}"
echo ""
echo "2. Conecte e faça push (cole no terminal):"
echo "   git remote add origin https://github.com/SEU_USUARIO/mobiliza-backend.git"
echo "   git push -u origin main"
echo ""
echo "3. Veja o guia completo em GITHUB.md"
echo ""
