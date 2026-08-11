@echo off
REM ============================================================
REM MOBILIZA - Gera Pitch Deck em PDF (13 slides)
REM ============================================================
REM Duplo-clique neste arquivo. Ele:
REM   1. Verifica se Python esta instalado
REM   2. Instala reportlab (se necessario)
REM   3. Executa o script create_pitch_pdf.py
REM   4. Abre o PDF gerado
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  MOBILIZA - Gerador de Pitch Deck em PDF
echo ============================================================
echo.

REM Verifica Python
where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao encontrado.
  echo.
  echo Baixe e instale em: https://www.python.org/downloads/
  echo Marque "Add Python to PATH" durante a instalacao.
  echo.
  pause
  exit /b 1
)

python --version
echo.

REM Instala reportlab se necessario
echo Verificando reportlab...
python -c "import reportlab" >nul 2>nul
if errorlevel 1 (
  echo [INFO] Instalando reportlab...
  python -m pip install reportlab
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar reportlab.
    pause
    exit /b 1
  )
) else (
  echo [OK] reportlab ja instalado.
)
echo.

REM Executa o script
echo Gerando PDF...
echo.
python create_pitch_pdf.py
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao gerar o PDF. Veja mensagens acima.
  pause
  exit /b 1
)

REM Abre o PDF
echo.
if exist "MOBILIZA_Pitch_2026.pdf" (
  echo Abrindo MOBILIZA_Pitch_2026.pdf...
  start "" "MOBILIZA_Pitch_2026.pdf"
) else (
  echo [AVISO] PDF nao encontrado.
)
echo.
echo ============================================================
echo  Concluido!
echo ============================================================
pause
