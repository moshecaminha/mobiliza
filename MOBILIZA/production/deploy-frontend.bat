@echo off
REM ============================================================
REM MOBILIZA - Copia o frontend para o repo e da push
REM ============================================================
REM Duplo-clique nesta arquivo. Ele:
REM   1. Copia MOBILIZA_App.html para production/public/
REM   2. git add + commit + push
REM Apos isso, o Vercel pode importar o repo com Root = public
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  MOBILIZA - Deploy do frontend para GitHub
echo ============================================================
echo.

REM Verifica git
where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Git nao encontrado.
  pause
  exit /b 1
)

REM Cria pasta public se nao existir
if not exist public mkdir public

REM Copia o HTML
echo Copiando MOBILIZA_App.html para production\public\...
copy /Y "..\MOBILIZA_App.html" "public\MOBILIZA_App.html" >nul
if errorlevel 1 (
  echo [ERRO] Falha ao copiar MOBILIZA_App.html
  pause
  exit /b 1
)
echo [OK] Arquivo copiado.
echo.

REM Verifica se vercel.json existe (ja criamos antes)
if not exist public\vercel.json (
  echo [AVISO] vercel.json nao encontrado em public\. Criando...
  echo {"version":2,"rewrites":[{"source":"/","destination":"/MOBILIZA_App.html"}]} > public\vercel.json
)
echo [OK] vercel.json pronto.
echo.

REM Stage, commit, push
echo Adicionando arquivos ao Git...
git add public/
git status --short
echo.

echo Commitando...
git commit -m "Add frontend (MOBILIZA_App.html + vercel.json) for Vercel deploy"
if errorlevel 1 (
  echo [INFO] Nada novo para commitar ou commit falhou.
) else (
  echo [OK] Commit criado.
)
echo.

echo Sincronizando com o remoto (pull --rebase)...
git pull --rebase origin main
if errorlevel 1 (
  echo [AVISO] Pull com rebase teve conflito. Tentando merge simples...
  git pull origin main --no-edit
)
echo.

echo Fazendo push para GitHub...
git push
if errorlevel 1 (
  echo [ERRO] Push falhou. Verifique seu PAT ou credenciais.
  pause
  exit /b 1
)
echo.

echo ============================================================
echo  PRONTO! Arquivos enviados para o GitHub.
echo ============================================================
echo.
echo Agora abra https://vercel.com/new no navegador,
echo importe o repositorio "mobiliza-backend",
echo configure Root Directory = public
echo e clique em Deploy.
echo.
echo Quando o deploy terminar, vou capturar o URL e mostrar.
echo.
pause
