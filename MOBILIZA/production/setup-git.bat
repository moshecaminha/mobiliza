@echo off
REM ============================================================
REM MOBILIZA - Setup Git para Windows
REM ============================================================
REM Inicializa repositorio Git local pronto para push ao GitHub.
REM Rode com duplo clique ou via cmd nesta pasta.

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo  MOBILIZA - Setup Git
echo ============================================================
echo.

REM Verifica se git esta instalado
where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Git nao encontrado.
  echo Instale em: https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)
git --version
echo.

REM Verifica se ja eh repositorio
if exist .git (
  echo [INFO] Repositorio Git ja existe nesta pasta.
  echo Pulando git init.
) else (
  echo Inicializando repositorio...
  git init
  git branch -M main
)
echo.

REM Cria .env se nao existir
if not exist .env (
  echo Criando .env a partir de .env.example...
  copy .env.example .env >nul
  echo [AVISO] Edite o .env antes de fazer deploy real!
  echo.
)

REM Verifica se .env esta no .gitignore
findstr /C:".env" .gitignore >nul 2>nul
if errorlevel 1 (
  echo .env >> .gitignore
  echo [OK] .env adicionado ao .gitignore
)

REM Stage e commit
echo Adicionando arquivos...
git add .
git status --short
echo.

set /p MSG="Mensagem do commit [Initial commit - MOBILIZA platform]: "
if "%MSG%"=="" set MSG=Initial commit - MOBILIZA platform

git commit -m "%MSG%"
if errorlevel 1 (
  echo [INFO] Nada novo para commitar
) else (
  echo [OK] Commit criado
)
echo.

echo ============================================================
echo  Repositorio local pronto!
echo ============================================================
echo.
echo Proximos passos:
echo.
echo 1. Crie um repo no GitHub:
echo    https://github.com/new
echo    Nome sugerido: mobiliza-backend
echo    Privado (recomendado)
echo.
echo 2. Conecte e faca push (cole no terminal):
echo    git remote add origin https://github.com/SEU_USUARIO/mobiliza-backend.git
echo    git push -u origin main
echo.
echo 3. Veja o guia completo em README.md
echo.
pause
