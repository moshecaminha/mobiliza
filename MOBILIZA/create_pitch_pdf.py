"""
MOBILIZA · Gerador de Pitch Deck em PDF
Uso: python create_pitch_pdf.py
Requer: pip install reportlab
Saída: MOBILIZA_Pitch_2026.pdf (13 slides, landscape 1280x720)
"""
from reportlab.lib.pagesizes import landscape
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFonts

# Paleta oficial MOBILIZA
NAVY = HexColor('#0A1628')
NAVY_2 = HexColor('#13213D')
NAVY_3 = HexColor('#1A2C4F')
BRAND = HexColor('#00A878')
BRAND_2 = HexColor('#00805F')
BRAND_3 = HexColor('#00E5A8')
GOLD = HexColor('#FFB800')
GOLD_2 = HexColor('#B45309')
CORAL = HexColor('#DC2626')
CORAL_LIGHT = HexColor('#FEE2E2')
BLUE = HexColor('#3B82F6')
BLUE_2 = HexColor('#1D4ED8')
PURPLE = HexColor('#7C3AED')
INK = HexColor('#0F172A')
INK_2 = HexColor('#1E293B')
MUTED = HexColor('#64748B')
MUTED_2 = HexColor('#94A3B8')
BORDER = HexColor('#E5E9F0')
SOFT = HexColor('#F1F5F9')
SOFT_2 = HexColor('#F8FAFC')
PAGE = HexColor('#F5F7FA')

# Dimensões: 1280x720 (16:9 padrão apresentação)
W, H = 1280, 720
MARGIN = 56

def rounded_rect(c, x, y, w, h, r, fill_color=None, stroke_color=None, stroke_width=1):
    """Retângulo arredondado helper"""
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    fill = 1 if fill_color else 0
    stroke = 1 if stroke_color else 0
    c.roundRect(x, y, w, h, r, stroke=stroke, fill=fill)

def draw_text(c, text, x, y, size=14, color=INK, bold=False, font='Helvetica'):
    """Draw text helper with default"""
    font_name = f"{font}-Bold" if bold else font
    c.setFont(font_name, size)
    c.setFillColor(color)
    c.drawString(x, y, text)

def draw_text_right(c, text, x, y, size=14, color=INK, bold=False, font='Helvetica'):
    font_name = f"{font}-Bold" if bold else font
    c.setFont(font_name, size)
    c.setFillColor(color)
    c.drawRightString(x, y, text)

def draw_text_center(c, text, x, y, size=14, color=INK, bold=False, font='Helvetica'):
    font_name = f"{font}-Bold" if bold else font
    c.setFont(font_name, size)
    c.setFillColor(color)
    c.drawCentredString(x, y, text)

def wrap_text(c, text, x, y, max_width, size=13, color=INK, line_height=18, bold=False):
    """Word-wrap text drawn line by line"""
    font_name = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font_name, size)
    c.setFillColor(color)
    words = text.split(' ')
    line = ''
    lines_drawn = 0
    for word in words:
        test = f"{line} {word}".strip()
        if c.stringWidth(test, font_name, size) <= max_width:
            line = test
        else:
            c.drawString(x, y - lines_drawn * line_height, line)
            line = word
            lines_drawn += 1
    if line:
        c.drawString(x, y - lines_drawn * line_height, line)
        lines_drawn += 1
    return lines_drawn * line_height  # returns total height used

def header(c, num_label):
    """Header padrão em todos os slides de conteúdo"""
    # Logo mini + MOBILIZA
    c.setFillColor(BRAND)
    c.roundRect(MARGIN, H - 62, 22, 22, 5, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN + 30, H - 55, "MOBILIZA")
    # Número + label
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(W - MARGIN, H - 55, num_label)

def header_dark(c, num_label):
    """Header em fundo escuro"""
    c.setFillColor(BRAND_3)
    c.roundRect(MARGIN, H - 62, 22, 22, 5, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN + 30, H - 55, "MOBILIZA")
    c.setFillColor(HexColor('#94A3B8'))
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(W - MARGIN, H - 55, num_label)

def title_block(c, eyebrow, title, lede=None):
    """Título padrão de slide de conteúdo"""
    # Eyebrow
    y = H - 130
    c.setFillColor(BRAND_2)
    c.rect(MARGIN, y + 4, 20, 2, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN + 28, y, eyebrow.upper())
    # Title
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 36)
    c.drawString(MARGIN, y - 40, title)
    # Lede
    if lede:
        wrap_text(c, lede, MARGIN, y - 68, W - 2*MARGIN, size=13, color=MUTED, line_height=17)

# ============ SLIDES ============

def slide_cover(c):
    # Background gradient (simulate with dark rect)
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Glow effect
    c.setFillColor(HexColor('#0A2540'))
    c.circle(W - 100, H - 100, 250, fill=1, stroke=0)
    c.setFillColor(HexColor('#0F2940'))
    c.circle(100, 100, 200, fill=1, stroke=0)
    header_dark(c, "2026")
    # Big logo box
    c.setFillColor(BRAND)
    c.roundRect(MARGIN + 40, H - 260, 68, 68, 14, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(MARGIN + 74, H - 236, "M")
    # Title
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 90)
    c.drawString(MARGIN + 40, H - 380, "MOBILIZA")
    # Tagline
    c.setFillColor(HexColor('#CBD5E1'))
    c.setFont("Helvetica", 22)
    wrap_text(c, "Plataforma estratégica de inteligência para campanhas eleitorais. Base, mapa, dados e compliance em uma só ferramenta.",
              MARGIN + 40, H - 440, 900, size=22, color=HexColor('#CBD5E1'), line_height=30)
    # Meta
    y = 80
    metas = [("ANO", "2026"), ("FORMATO", "Pitch Deck"), ("STATUS", "Em desenvolvimento ativo")]
    x = MARGIN + 40
    for label, val in metas:
        c.setFillColor(HexColor('#64748B'))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y + 22, label)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x, y, val)
        x += 220

def slide_desafio(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "02 · O DESAFIO")
    title_block(c, "Contexto", "Campanhas políticas ainda operam no improviso",
                "Dados espalhados em planilhas, base de apoiadores sem controle, prestação de contas manual e nenhuma inteligência territorial em tempo real.")
    # 4 problem cards em grid 2x2
    problems = [
        ("Base fragmentada", "Militantes cadastrados em cadernos, planilhas e grupos de WhatsApp desconectados. Duplicatas, dados perdidos.", "70%", "dos cadastros nunca chegam ao coordenador central"),
        ("Sem visão territorial", "Nenhum sistema para saber onde a base está fisicamente. Estratégia de campo baseada em intuição.", "R$ 380mi", "gastos em campanhas 2024 sem tracking territorial"),
        ("Compliance TSE manual", "Prestação montada em cima da hora. Doações em papel. Categorização no fim da campanha.", "1 em 4", "candidatos têm contas rejeitadas ou com ressalva"),
        ("Ruído fora de controle", "Menções em redes sociais, blogs e portais rolam a olho nu. Fake news chegam ao comitê após viralizar.", "48h", "tempo médio para reagir a crise · deveria ser 4h"),
    ]
    card_w = (W - 2*MARGIN - 20) / 2
    card_h = 190
    positions = [(MARGIN, 250), (MARGIN + card_w + 20, 250), (MARGIN, 60), (MARGIN + card_w + 20, 60)]
    for i, (title, desc, stat, sub) in enumerate(problems):
        x, y = positions[i]
        # Card bg
        c.setFillColor(SOFT_2)
        c.roundRect(x, y, card_w, card_h, 12, fill=1, stroke=0)
        # Left border coral
        c.setFillColor(CORAL)
        c.rect(x, y, 4, card_h, fill=1, stroke=0)
        # Content
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(x + 24, y + card_h - 30, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 11)
        wrap_text(c, desc, x + 24, y + card_h - 52, card_w - 48, size=11, color=MUTED, line_height=15)
        # Stat
        c.setFillColor(CORAL)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(x + 24, y + 40, stat)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        c.drawString(x + 24, y + 20, sub)

def slide_solucao(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "03 · SOLUÇÃO")
    title_block(c, "Nossa proposta", "Um painel único, três pilares de valor",
                "MOBILIZA integra base, mapa e compliance em uma plataforma web acessível de qualquer navegador — sem instalação.")
    # 3 pilares
    pillars = [
        ("Base viva e viral", "Cada liderança gera QR code próprio para recrutar militantes. Hierarquia: candidato → vereador → suplente → liderança → militância.", "RECRUTAMENTO SEM FRICÇÃO"),
        ("Inteligência territorial", "Mapa Leaflet com IBGE. Cada cadastro no CEP exato via BrasilAPI. Estado, município, distritos e bairros. Heatmap ao vivo.", "ESTRATÉGIA POR ENDEREÇO"),
        ("Compliance nativo", "Módulo financeiro estruturado para TSE. Doações com CPF/CNPJ, categorização automática. Trilha de auditoria completa.", "LEI 9.504/97 EMBUTIDA"),
    ]
    pw = (W - 2*MARGIN - 48) / 3
    ph = 380
    x0 = MARGIN
    y0 = 60
    for i, (t, d, footer) in enumerate(pillars):
        x = x0 + i * (pw + 24)
        # Card
        c.setFillColor(white)
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.roundRect(x, y0, pw, ph, 16, fill=1, stroke=1)
        # Icon box (top left)
        c.setFillColor(BRAND)
        c.roundRect(x + 26, y0 + ph - 76, 50, 50, 12, fill=1, stroke=0)
        # Title
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(x + 26, y0 + ph - 108, t)
        # Description
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 12)
        wrap_text(c, d, x + 26, y0 + ph - 132, pw - 52, size=12, color=MUTED, line_height=16)
        # Footer
        c.setStrokeColor(BORDER)
        c.line(x + 26, y0 + 50, x + pw - 26, y0 + 50)
        c.setFillColor(BRAND_2)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x + 26, y0 + 26, footer)

def slide_modulos(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "04 · PRODUTO")
    title_block(c, "Visão geral", "11 módulos integrados em um único painel",
                "Do dashboard estratégico à prestação de contas TSE, tudo se conecta. Sem trocar de sistema.")
    modules = [
        ("Dashboard", "Visão executiva com mapa, KPIs e insights", BRAND),
        ("Inteligência Geo", "Heatmap territorial + intensidade competitiva", BRAND),
        ("Radar Social", "Menções nas redes com sentimento e alertas", BRAND),
        ("Radar Eleitoral", "Cenário competitivo · adversários · projeção", GOLD_2),
        ("Equipe", "Vereador · Suplente · Liderança · Militância + QR", GOLD_2),
        ("Projeção de Votos", "Meta por eleitores × influência × conversão", GOLD_2),
        ("Agenda", "Compromissos + notificações e-mail/SMS", BLUE),
        ("Comunicação", "Templates + disparo WhatsApp segmentado", BLUE),
        ("IA Insights", "Ações estratégicas priorizadas por score", PURPLE),
    ]
    cols = 3
    rows = 3
    grid_x = MARGIN
    grid_y = 60
    grid_w = W - 2 * MARGIN
    grid_h = 420
    cell_w = (grid_w - (cols - 1) * 14) / cols
    cell_h = (grid_h - (rows - 1) * 14) / rows
    for i, (name, desc, color) in enumerate(modules):
        col = i % cols
        row = rows - 1 - (i // cols)
        x = grid_x + col * (cell_w + 14)
        y = grid_y + row * (cell_h + 14)
        # Card
        c.setFillColor(SOFT_2)
        c.setStrokeColor(BORDER)
        c.roundRect(x, y, cell_w, cell_h, 12, fill=1, stroke=1)
        # Icon circle
        c.setFillColor(color)
        c.circle(x + 30, y + cell_h - 30, 20, fill=1, stroke=0)
        # Name
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(x + 66, y + cell_h - 26, name)
        # Description
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        wrap_text(c, desc, x + 66, y + cell_h - 46, cell_w - 76, size=10, color=MUTED, line_height=13)

def slide_mapa(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "05 · DIFERENCIAL")
    title_block(c, "Feature marco", "Mapa Estratégico com pin no CEP exato",
                "Cada cadastro é geocodificado por CEP oficial. Ruas, bairros, distritos — vista estado ou município. Heatmap de densidade de apoio.")
    # Left: fake map illustration
    map_x = MARGIN
    map_y = 80
    map_w = 660
    map_h = 380
    c.setFillColor(SOFT_2)
    c.setStrokeColor(BORDER)
    c.roundRect(map_x, map_y, map_w, map_h, 14, fill=1, stroke=1)
    # Green border box
    inner_x, inner_y = map_x + 24, map_y + 60
    inner_w, inner_h = map_w - 48, map_h - 100
    c.setFillColor(HexColor('#DDF3E9'))
    c.setStrokeColor(BRAND)
    c.setLineWidth(2)
    c.roundRect(inner_x, inner_y, inner_w, inner_h, 12, fill=1, stroke=1)
    # Draw city polygon
    c.setStrokeColor(BRAND_2)
    c.setLineWidth(2)
    p = c.beginPath()
    p.moveTo(inner_x + 200, inner_y + 200)
    p.curveTo(inner_x + 150, inner_y + 250, inner_x + 200, inner_y + 100, inner_x + 300, inner_y + 100)
    p.curveTo(inner_x + 450, inner_y + 130, inner_x + 500, inner_y + 200, inner_x + 400, inner_y + 250)
    p.curveTo(inner_x + 300, inner_y + 240, inner_x + 250, inner_y + 230, inner_x + 200, inner_y + 200)
    c.drawPath(p, stroke=1, fill=0)
    # Pins (with initials)
    pins = [
        (250, 190, BLUE, 'JC', white),
        (310, 210, white, 'MS', INK),
        (370, 180, PURPLE, 'RS', white),
        (290, 150, GOLD, 'LC', INK),
        (340, 145, CORAL, 'PP', white),
        (400, 200, CORAL, 'AF', white),
    ]
    for px, py, color, letters, text_color in pins:
        c.setFillColor(color)
        c.setStrokeColor(white)
        c.setLineWidth(2)
        c.circle(inner_x + px, inner_y + py, 12, fill=1, stroke=1)
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(inner_x + px, inner_y + py - 3, letters)
    # Right: 3 features
    fx = map_x + map_w + 24
    fw = W - MARGIN - fx
    features = [
        ("IBGE oficial", "5.570 municípios do BR indexados · malhas geográficas em GeoJSON."),
        ("CEP com lat/lng", "BrasilAPI + Nominatim OSM · endereço exato em 2 segundos."),
        ("Heatmap ao vivo", "Concentração de apoiadores · intensidade competitiva por bairro."),
    ]
    fy = 380
    for title, desc in features:
        c.setFillColor(SOFT_2)
        c.roundRect(fx, fy, fw, 90, 10, fill=1, stroke=0)
        c.setFillColor(BRAND)
        c.roundRect(fx + 14, fy + 27, 36, 36, 9, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(fx + 62, fy + 62, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 11)
        wrap_text(c, desc, fx + 62, fy + 40, fw - 76, size=11, color=MUTED, line_height=14)
        fy -= 110

def slide_hierarquia(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "06 · EQUIPE")
    title_block(c, "Estrutura hierárquica", "Cinco níveis, cadastro em cascata",
                "Cada nível tem meta de votos individual. Toda a base rolls up até o candidato.")
    # Pyramid on left
    px, py = MARGIN + 60, 100
    layers = [
        (60, 0, BLUE, "CANDIDATO", white),
        (30, 70, white, "VEREADORES", INK, BORDER),
        (0, 140, PURPLE, "SUPLENTES", white),
        (-50, 210, GOLD, "LIDERANÇAS & CABOS", INK),
        (-100, 280, CORAL, "MILITÂNCIA VOLUNTÁRIA", white),
    ]
    y_base = py + 320
    for entry in layers:
        offset, y_off, color, label, text_c = entry[0], entry[1], entry[2], entry[3], entry[4]
        stroke_c = entry[5] if len(entry) > 5 else None
        layer_w = 120 + abs(offset) * 2 + 40  # wider as we go down
        if y_off == 0: layer_w = 120
        if y_off == 70: layer_w = 180
        if y_off == 140: layer_w = 250
        if y_off == 210: layer_w = 340
        if y_off == 280: layer_w = 440
        cx = px + 180
        rect_x = cx - layer_w / 2
        c.setFillColor(color)
        if stroke_c:
            c.setStrokeColor(stroke_c)
            c.setLineWidth(1)
            c.roundRect(rect_x, y_base - y_off, layer_w, 55, 8, fill=1, stroke=1)
        else:
            c.roundRect(rect_x, y_base - y_off, layer_w, 55, 8, fill=1, stroke=0)
        c.setFillColor(text_c)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(cx, y_base - y_off + 22, label)
    # Right: info panel
    info_x = MARGIN + 480
    info_y = 90
    info_w = W - MARGIN - info_x
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(info_x, 380, "Cada pessoa importa")
    roles = [
        ("Candidato(a)", "Cargo alvo", BLUE),
        ("Vereadores", "Coligação", white),
        ("Suplentes", "Reserva estratégica", PURPLE),
        ("Lideranças", "Recrutam base", GOLD),
        ("Militância", "Voluntários em campo", CORAL),
    ]
    y = 350
    for name, desc, dot_c in roles:
        c.setFillColor(dot_c)
        c.circle(info_x + 8, y - 4, 6, fill=1, stroke=1)
        c.setStrokeColor(INK if dot_c == white else dot_c)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(info_x + 26, y - 4, name)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 11)
        c.drawRightString(info_x + info_w - 10, y - 4, desc)
        y -= 34
    # Green tip
    c.setFillColor(HexColor('#E6F7F0'))
    c.roundRect(info_x, y - 34, info_w, 40, 8, fill=1, stroke=0)
    c.setFillColor(BRAND_2)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(info_x + 12, y - 20, "Cadastro por CEP · geocode automático · cross-device")

def slide_qr(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "07 · CRESCIMENTO")
    title_block(c, "Recrutamento viral", "QR code por liderança · autoserviço",
                "Cada vereador, suplente e liderança tem seu próprio QR. Militante escaneia, preenche 30 segundos, entra na base do padrinho.")
    # 4 steps horizontal
    steps = [
        ("1", "Vereador gera QR", "Clica no ícone # ao lado do nome. QR aparece."),
        ("2", "Compartilha", "WhatsApp, e-mail ou impresso em cartaz."),
        ("3", "Militante cadastra", "Escaneia → nome, WhatsApp, CEP. 30 segundos."),
        ("4", "Aparece no painel", "Sync automático · vinculado ao vereador certo."),
    ]
    total_w = W - 2 * MARGIN
    step_w = (total_w - 3 * 20) / 4
    y = 200
    for i, (n, title, desc) in enumerate(steps):
        x = MARGIN + i * (step_w + 20)
        c.setFillColor(white)
        c.setStrokeColor(BORDER)
        c.roundRect(x, y, step_w, 200, 12, fill=1, stroke=1)
        # Circle
        c.setFillColor(white)
        c.setStrokeColor(BRAND)
        c.setLineWidth(3)
        c.circle(x + step_w/2, y + 156, 24, fill=1, stroke=1)
        c.setFillColor(BRAND_2)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(x + step_w/2, y + 148, n)
        # Title
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(x + step_w/2, y + 108, title)
        # Description
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        # Center wrap
        wrapped = []
        words = desc.split(' ')
        line = ''
        for w in words:
            test = f"{line} {w}".strip()
            if c.stringWidth(test, "Helvetica", 10) <= step_w - 20:
                line = test
            else:
                wrapped.append(line)
                line = w
        if line: wrapped.append(line)
        for j, ln in enumerate(wrapped):
            c.drawCentredString(x + step_w/2, y + 82 - j * 13, ln)
    # Bottom text
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 14)
    c.drawCentredString(W / 2, 100, "Rede de recrutamento cresce sem centralização. A plataforma consolida tudo automaticamente.")

def slide_seguranca(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "08 · SEGURANÇA")
    title_block(c, "Segurança da informação", "Quatro camadas de proteção",
                "Dados eleitorais são sensíveis. MOBILIZA implementa práticas de nível corporativo desde o dia zero.")
    # 2x2 dark cards
    cards = [
        ("Autenticação JWT", "Login por OTP em 2 canais (SMS + e-mail). Token JWT 30 dias, HS256. Rate-limited.", ["JWT HS256", "OTP dual channel", "Rate limit"]),
        ("Criptografia total", "HTTPS obrigatório (Vercel + Railway). Senhas bcrypt. Postgres SSL.", ["TLS 1.3", "bcrypt", "Postgres SSL"]),
        ("Isolamento multi-tenant", "Cada campanha em org separada com escopo forçado no banco.", ["Row-level security", "Org scoping", "Helmet.js"]),
        ("Auditoria completa", "Toda criação/edição/exclusão registrada. Backup diário do banco.", ["audit_logs", "Backup 24h", "Soft delete"]),
    ]
    card_w = (W - 2 * MARGIN - 20) / 2
    card_h = 200
    positions = [(MARGIN, 250), (MARGIN + card_w + 20, 250), (MARGIN, 40), (MARGIN + card_w + 20, 40)]
    for i, (t, d, badges) in enumerate(cards):
        x, y = positions[i]
        c.setFillColor(NAVY)
        c.roundRect(x, y, card_w, card_h, 14, fill=1, stroke=0)
        # Icon box
        c.setFillColor(HexColor('#0F4F3C'))
        c.roundRect(x + 22, y + card_h - 66, 44, 44, 10, fill=1, stroke=0)
        # Title
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(x + 22, y + card_h - 96, t)
        # Description
        c.setFillColor(HexColor('#CBD5E1'))
        c.setFont("Helvetica", 11)
        wrap_text(c, d, x + 22, y + card_h - 118, card_w - 44, size=11, color=HexColor('#CBD5E1'), line_height=15)
        # Badges
        bx = x + 22
        by = y + 30
        c.setFont("Helvetica-Bold", 9)
        for badge in badges:
            bw = c.stringWidth(badge, "Helvetica-Bold", 9) + 16
            c.setFillColor(HexColor('#0F4F3C'))
            c.roundRect(bx, by, bw, 18, 5, fill=1, stroke=0)
            c.setFillColor(BRAND_3)
            c.drawString(bx + 8, by + 5, badge)
            bx += bw + 6

def slide_lgpd(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "09 · LGPD")
    title_block(c, "Conformidade legal", "LGPD embutida na arquitetura",
                "Lei 13.709/18 não é opcional. MOBILIZA respeita cada princípio do tratamento de dados pessoais.")
    # Left: checklist
    lx = MARGIN
    ly = 60
    lw = 640
    lh = 420
    checks = [
        ("Consentimento explícito", "Todo cadastro via QR exige opt-in claro. Selo LGPD visível."),
        ("Minimização de dados", "Só armazenamos o essencial. Sem CPF exigido."),
        ("Direito ao esquecimento", "Militante pode solicitar remoção. Purge após 30 dias."),
        ("Finalidade específica", "Dados usados apenas para comunicação da campanha."),
        ("Transparência", "Militante vê seus dados e exporta em JSON."),
        ("DPO designado", "Campanha nomeia responsável. Incidentes rastreáveis."),
    ]
    y = ly + lh - 20
    for title, desc in checks:
        # Check icon
        c.setFillColor(BRAND)
        c.roundRect(lx, y - 26, 30, 30, 8, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(lx + 15, y - 18, "✓")
        # Title & desc
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(lx + 44, y - 8, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 11)
        wrap_text(c, desc, lx + 44, y - 26, lw - 60, size=11, color=MUTED, line_height=14)
        y -= 60
    # Right: dark stat panel
    rx = MARGIN + 660
    rw = W - MARGIN - rx
    c.setFillColor(NAVY)
    c.roundRect(rx, 60, rw, 420, 14, fill=1, stroke=0)
    c.setFillColor(BRAND_3)
    c.setFont("Helvetica-Bold", 84)
    c.drawString(rx + 30, 380, "100%")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(rx + 30, 330, "Compliance por design")
    c.setFillColor(HexColor('#CBD5E1'))
    c.setFont("Helvetica", 12)
    wrap_text(c, "LGPD não é feature retroativa — está na base do modelo de dados desde a primeira linha de código.",
              rx + 30, 300, rw - 60, size=12, color=HexColor('#CBD5E1'), line_height=16)
    # Warning box
    c.setFillColor(HexColor('#0F4F3C'))
    c.roundRect(rx + 20, 100, rw - 40, 90, 8, fill=1, stroke=0)
    c.setFillColor(HexColor('#CBD5E1'))
    c.setFont("Helvetica", 11)
    wrap_text(c, "Multas por descumprimento chegam a R$ 50 milhões por infração (Art. 52). Campanhas não podem correr esse risco.",
              rx + 34, 170, rw - 68, size=11, color=HexColor('#CBD5E1'), line_height=15)

def slide_stack(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "10 · STACK")
    title_block(c, "Base tecnológica", "Stack moderna, cloud-native, escalável",
                "Escolha de tecnologias maduras. Provedores gerenciados. Zero cluster próprio, zero dor operacional.")
    # 4x2 grid
    items = [
        ("Vanilla JS", "Frontend sem framework", HexColor('#F7DF1E'), INK, "FRONTEND"),
        ("Node.js 20", "Backend Express + JWT", HexColor('#68A063'), white, "BACKEND"),
        ("PostgreSQL 15", "17 tabelas multi-tenant", HexColor('#336791'), white, "DATABASE"),
        ("Leaflet 1.9", "Mapa · MIT · 42kb", HexColor('#199900'), white, "MAPS"),
        ("Vercel", "CDN global · deploy 30s", HexColor('#000000'), white, "HOSTING"),
        ("Railway", "Node + Postgres gerenciado", HexColor('#7C3AED'), white, "INFRA"),
        ("Chart.js", "Gráficos · MIT license", HexColor('#FF6B6B'), white, "CHARTS"),
        ("GitHub Actions", "CI/CD auto-deploy", INK, white, "DEVOPS"),
    ]
    cols = 4
    rows = 2
    grid_x = MARGIN
    grid_y = 60
    grid_w = W - 2 * MARGIN
    grid_h = 420
    cell_w = (grid_w - (cols - 1) * 14) / cols
    cell_h = (grid_h - (rows - 1) * 14) / rows
    for i, (name, desc, color, text_c, tag) in enumerate(items):
        col = i % cols
        row = rows - 1 - (i // cols)
        x = grid_x + col * (cell_w + 14)
        y = grid_y + row * (cell_h + 14)
        c.setFillColor(SOFT_2)
        c.setStrokeColor(BORDER)
        c.roundRect(x, y, cell_w, cell_h, 12, fill=1, stroke=1)
        # Big colored circle icon
        c.setFillColor(color)
        c.circle(x + cell_w / 2, y + cell_h - 60, 26, fill=1, stroke=0)
        c.setFillColor(text_c)
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(x + cell_w / 2, y + cell_h - 66, name[0])
        # Name
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(x + cell_w / 2, y + cell_h - 110, name)
        # Desc
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        c.drawCentredString(x + cell_w / 2, y + cell_h - 128, desc)
        # Tag
        c.setFillColor(BRAND_2)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(x + cell_w / 2, y + 22, tag)

def slide_apis(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "11 · INTEGRAÇÕES")
    title_block(c, "APIs oficiais", "Dados reais, fontes confiáveis",
                "Todas as integrações usam APIs públicas oficiais. Nenhum dado inventado, nenhuma dependência opaca.")
    apis = [
        ("IBGE GeoServices", "Malhas geográficas de 5.570 municípios + 27 estados. Nomes, códigos, mesorregiões oficiais.", "MAPA · CIDADES", HexColor('#005580'), True),
        ("ViaCEP", "API oficial dos Correios. Retorna logradouro, bairro, cidade e UF a partir do CEP.", "AUTOCOMPLETE DE ENDEREÇO", HexColor('#0066CC'), True),
        ("BrasilAPI v2", "CEP com lat/lng oficial. Base de dados aberta e atualizada. Fallback para Nominatim.", "GEOCODIFICAÇÃO", HexColor('#00A878'), True),
        ("OpenStreetMap", "Tiles CARTO Voyager · nomes de ruas, bairros. Base cartográfica de código aberto.", "CAMADAS DE MAPA", HexColor('#7CB342'), True),
        ("TSE Dados Abertos", "Resultados eleitorais 2010-2024, cadastro de candidatos, estatísticas de eleitorado.", "HISTÓRICO · TENDÊNCIAS", HexColor('#1E40AF'), True),
        ("OpenAI GPT-4", "Análise estratégica opcional. Gera insights priorizados por score. Chave própria do usuário.", "IA INSIGHTS", HexColor('#10A37F'), False),
    ]
    cols = 3
    rows = 2
    grid_x = MARGIN
    grid_y = 60
    grid_w = W - 2 * MARGIN
    grid_h = 420
    cell_w = (grid_w - (cols - 1) * 16) / cols
    cell_h = (grid_h - (rows - 1) * 16) / rows
    for i, (name, desc, use, color, is_free) in enumerate(apis):
        col = i % cols
        row = rows - 1 - (i // cols)
        x = grid_x + col * (cell_w + 16)
        y = grid_y + row * (cell_h + 16)
        c.setFillColor(white)
        c.setStrokeColor(BORDER)
        c.roundRect(x, y, cell_w, cell_h, 12, fill=1, stroke=1)
        # Icon box
        c.setFillColor(color)
        c.roundRect(x + 22, y + cell_h - 56, 34, 34, 10, fill=1, stroke=0)
        # Free badge
        badge_text = "GRÁTIS" if is_free else "FREEMIUM"
        badge_color = HexColor('#DCFCE7') if is_free else HexColor('#FEF3C7')
        badge_text_color = HexColor('#166534') if is_free else HexColor('#92400E')
        c.setFillColor(badge_color)
        c.roundRect(x + cell_w - 74, y + cell_h - 28, 60, 20, 5, fill=1, stroke=0)
        c.setFillColor(badge_text_color)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + cell_w - 44, y + cell_h - 22, badge_text)
        # Name
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(x + 22, y + cell_h - 90, name)
        # Description
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        wrap_text(c, desc, x + 22, y + cell_h - 110, cell_w - 44, size=10, color=MUTED, line_height=13)
        # Use tag
        c.setFillColor(BRAND_2)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 22, y + 20, use)

def slide_infra(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "12 · INFRAESTRUTURA")
    title_block(c, "Arquitetura", "Cloud-native, sem servidor próprio",
                "Frontend na CDN da Vercel. Backend + Postgres no Railway. Zero manutenção, escala automática, HTTPS por padrão.")
    # Left: dark diagram
    dx = MARGIN
    dy = 60
    dw = 620
    dh = 420
    c.setFillColor(NAVY)
    c.roundRect(dx, dy, dw, dh, 14, fill=1, stroke=0)
    # Label
    c.setFillColor(HexColor('#94A3B8'))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(dx + 30, dy + dh - 40, "ARQUITETURA EM CAMADAS")
    # 3 boxes
    box_data = [
        ("CAMADA 1 · CLIENTE", "Vercel CDN Global", "HTML/JS estático · TLS 1.3 · Cache edge", HexColor('#0F4F3C'), BRAND_3),
        ("CAMADA 2 · APLICAÇÃO", "Railway · Node.js 20 + Express", "API REST · JWT · Rate limit · Multi-tenant", HexColor('#5C3A00'), GOLD),
        ("CAMADA 3 · DADOS", "Railway PostgreSQL 15", "17 tabelas · SSL obrigatório · Backup diário", HexColor('#1A365D'), BLUE),
    ]
    by = dy + dh - 100
    for label, title, desc, box_c, accent_c in box_data:
        c.setFillColor(box_c)
        c.setStrokeColor(accent_c)
        c.setLineWidth(1)
        c.roundRect(dx + 30, by, dw - 60, 80, 10, fill=1, stroke=1)
        c.setFillColor(HexColor('#94A3B8'))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(dx + 42, by + 60, label)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(dx + 42, by + 38, title)
        c.setFillColor(HexColor('#CBD5E1'))
        c.setFont("Helvetica", 10)
        c.drawString(dx + 42, by + 18, desc)
        by -= 100
        # Arrow
        if by > dy + 30:
            c.setFillColor(BRAND_3)
            c.setFont("Helvetica-Bold", 16)
            c.drawCentredString(dx + dw / 2, by + 78, "↓")
    # Right: 4 detail rows
    rx = MARGIN + 640
    rw = W - MARGIN - rx
    details = [
        ("Escala automática", "Vercel escala globalmente. Railway suporta 1M req/mês."),
        ("CI/CD contínuo", "Push no GitHub → deploy em 30s no Vercel e 1min no Railway."),
        ("Backup e DR", "Snapshot Postgres a cada 24h · exportação JSON completa."),
        ("Custo baixíssimo", "~US$ 10/mês por campanha no Hobby plan. Cresce sob demanda."),
    ]
    y = 400
    for title, desc in details:
        c.setFillColor(SOFT_2)
        c.roundRect(rx, y - 60, rw, 80, 10, fill=1, stroke=0)
        c.setFillColor(BRAND)
        c.roundRect(rx + 14, y - 24, 36, 36, 9, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(rx + 62, y - 4, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 11)
        wrap_text(c, desc, rx + 62, y - 24, rw - 76, size=11, color=MUTED, line_height=14)
        y -= 100

def slide_roadmap(c):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "13 · ROADMAP")
    title_block(c, "Próximos passos", "Evolução planejada em 4 fases",
                "Onde estamos, o que vem a seguir. Metas claras, prazos realistas, entrega incremental.")
    phases = [
        ("01", "Foundation MVP", ["Base cadastral (11 módulos)", "Mapa municipal e estadual", "Sistema QR + auto-cadastro", "Multi-tenant + auth JWT", "Compliance LGPD básico"], "Q1 2026 · em produção", True),
        ("02", "Integração TSE", ["Importador CSV oficial TSE", "Perfil sociodemográfico", "Histórico 5 eleições", "Ranking dos eleitos", "Export prestação de contas"], "Q2 2026", False),
        ("03", "Multi-usuário", ["Login por liderança", "Escopo restrito de dados", "Convites por magic link", "Permissões granulares", "Coordenadores regionais"], "Q3 2026", False),
        ("04", "IA e automação", ["Assistente estratégico IA", "Alertas preditivos", "Análise sentimento real-time", "Auto-segmentação de bases", "Recomendações territoriais"], "Q4 2026", False),
    ]
    total_w = W - 2 * MARGIN
    phase_w = (total_w - 3 * 14) / 4
    y = 80
    ph = 400
    for i, (num, title, items, when, current) in enumerate(phases):
        x = MARGIN + i * (phase_w + 14)
        # Card
        c.setFillColor(white)
        if current:
            c.setStrokeColor(BRAND)
            c.setLineWidth(2.5)
        else:
            c.setStrokeColor(BORDER)
            c.setLineWidth(1)
        c.roundRect(x, y, phase_w, ph, 14, fill=1, stroke=1)
        # ATUAL tag
        if current:
            c.setFillColor(BRAND)
            c.roundRect(x + phase_w / 2 - 26, y + ph - 12, 52, 22, 5, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(x + phase_w / 2, y + ph - 5, "ATUAL")
        # Num
        c.setFillColor(BRAND_2 if current else MUTED_2)
        c.setFont("Helvetica-Bold", 42)
        c.drawString(x + 22, y + ph - 60, num)
        # Title
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 22, y + ph - 100, title)
        # Items
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 10)
        iy = y + ph - 130
        for item in items:
            # Bullet
            c.setFillColor(BRAND_2)
            c.circle(x + 26, iy + 4, 3, fill=1, stroke=0)
            c.setFillColor(MUTED)
            wrap_text(c, item, x + 36, iy + 4, phase_w - 60, size=10, color=MUTED, line_height=12)
            iy -= 32
        # When
        c.setStrokeColor(BORDER)
        c.line(x + 22, y + 32, x + phase_w - 22, y + 32)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 22, y + 16, when.upper())

# ============ MAIN ============

def build_pdf(output="MOBILIZA_Pitch_2026.pdf"):
    c = canvas.Canvas(output, pagesize=(W, H))
    c.setTitle("MOBILIZA · Pitch Deck 2026")
    c.setAuthor("MOBILIZA")
    c.setSubject("Plataforma estratégica de inteligência para campanhas eleitorais")

    slides = [
        slide_cover,
        slide_desafio,
        slide_solucao,
        slide_modulos,
        slide_mapa,
        slide_hierarquia,
        slide_qr,
        slide_seguranca,
        slide_lgpd,
        slide_stack,
        slide_apis,
        slide_infra,
        slide_roadmap,
    ]
    for i, slide_fn in enumerate(slides):
        slide_fn(c)
        c.showPage()
        print(f"  ✓ Slide {i+1}/{len(slides)} · {slide_fn.__name__.replace('slide_','').title()}")
    c.save()
    print(f"\n✓ PDF gerado: {output}")
    print(f"  {len(slides)} slides · {W}x{H}px (16:9 landscape)")

if __name__ == '__main__':
    print("MOBILIZA · Gerando Pitch Deck em PDF...")
    print("-" * 50)
    try:
        build_pdf()
    except ImportError:
        print("\n✗ ERRO: ReportLab não instalado.")
        print("  Rode: pip install reportlab")
    except Exception as e:
        print(f"\n✗ ERRO: {e}")
        import traceback
        traceback.print_exc()
