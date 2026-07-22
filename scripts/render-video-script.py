from pathlib import Path
from shutil import copyfile

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = REPO_ROOT / "output" / "pdf" / "Second_Word_Script_Updated.pdf"
HANDOFF = PROJECT_ROOT / "output" / "pdf" / "Second_Word_Script_Updated.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
HANDOFF.parent.mkdir(parents=True, exist_ok=True)

INK = HexColor("#16181D")
PAPER = HexColor("#F3F0E9")
MUTED = HexColor("#77736B")
CLAY = HexColor("#C4705A")
GOLD = HexColor("#B9852D")
WHITE = HexColor("#ECE9E2")
RULE = HexColor("#D8D3CA")

styles = getSampleStyleSheet()

cover_eyebrow = ParagraphStyle(
    "cover_eyebrow", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9, leading=12, tracking=2.2, textColor=MUTED, alignment=TA_CENTER,
)
cover_title = ParagraphStyle(
    "cover_title", parent=styles["Title"], fontName="Times-Roman",
    fontSize=44, leading=48, textColor=WHITE, alignment=TA_CENTER, spaceAfter=10,
)
cover_subtitle = ParagraphStyle(
    "cover_subtitle", parent=styles["Normal"], fontName="Times-Italic",
    fontSize=17, leading=23, textColor=HexColor("#AAA69D"), alignment=TA_CENTER,
)
section_kicker = ParagraphStyle(
    "section_kicker", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8.5, leading=12, tracking=1.5, textColor=CLAY, spaceAfter=8,
)
section_title = ParagraphStyle(
    "section_title", parent=styles["Heading1"], fontName="Times-Roman",
    fontSize=26, leading=30, textColor=INK, spaceAfter=16,
)
label = ParagraphStyle(
    "label", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8, leading=11, tracking=1.2, textColor=MUTED, spaceBefore=10, spaceAfter=5,
)
body = ParagraphStyle(
    "body", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.5, leading=14.5, textColor=INK, spaceAfter=8,
)
voice = ParagraphStyle(
    "voice", parent=body, fontName="Times-Italic", fontSize=11.5,
    leading=17, textColor=INK, leftIndent=14, borderColor=CLAY,
    borderWidth=0, borderPadding=(0, 0, 0, 10),
)
onscreen = ParagraphStyle(
    "onscreen", parent=body, fontName="Helvetica-Bold", fontSize=9,
    leading=14, textColor=GOLD, backColor=HexColor("#EEE7DB"),
    borderPadding=8, spaceBefore=4,
)
small = ParagraphStyle(
    "small", parent=body, fontSize=8.5, leading=13, textColor=MUTED,
)


SECTIONS = [
    (
        "0:00-0:22", "Words move faster than wisdom",
        "Black screen. Notification sounds accelerate. Fast cuts across email, Slack, WhatsApp, Teams and X. A rejection arrives. A rent reminder arrives. Someone is blamed in a work thread. Cursors blink. Thumbs hover over Send.",
        "Every day, the words that shape our relationships are written here. In the reply after rejection. In the message sent under pressure. In the sentence we may still regret a year from now. Our words have never travelled faster. Wisdom has never had less time to catch up.",
        "Notifications stop. One quiet cursor remains.",
    ),
    (
        "0:22-0:42", "Reveal the category",
        "Open the public Second Word experience. Show the quiet mark inside an empty composer. Click it. Today's verified Verse of the Day opens. Collapse References. Return to the empty composer.",
        "Other writing tools ask whether your sentence is correct. Second Word asks what kind of human moment this is. Before you type, the Word is already near. It does not read the empty box. It simply offers today's Scripture when you ask.",
        None,
    ),
    (
        "0:42-1:22", "Guard in the actual moment",
        "Choose Gmail, then The rejection. Fill the suggested angry response. Do not click anything. After typing settles, Living Margin marks the exact phrases and the Second Word invitation appears. Send remains visible. Open the card. Show the verified passage, reviewed explanation, one relational question and collapsed publisher References.",
        "When the words carry weight, Second Word notices on its own. It never changes the editor and never blocks Send. Living Margin shows what invited the pause. Gloo identifies the human moment and ranks only reviewed references. YouVersion alone supplies the Scripture text. The model cannot invent a verse, and its internal commentary never reaches the person.",
        "GLOO AI STUDIO  ->  REVIEWED REFERENCE ID  ->  YOUVERSION VERIFIED PASSAGE",
    ),
    (
        "1:22-1:48", "Agency, not automation",
        "Choose Show alternatives. Compare an alternative with the untouched original. Keep editing instead of replacing it. Change one marked phrase and show the mark disappear immediately.",
        "Second Word does not speak for you. An alternative is optional and tied to the exact draft that was analysed. Edit the words and the permission expires. There is no auto-send, no moral score and no forced rewrite. The person remains the author.",
        None,
    ),
    (
        "1:48-2:18", "The full human story",
        "Fast, legible cuts: Gmail rent reminder receives provision; WhatsApp grief receives care without a casual rewrite; Slack freely carrying a colleague receives a gold Guide with no question; LinkedIn good news receives gratitude; neutral scheduling receives nothing.",
        "This is not an anger detector. The Word can guard what may wound, meet fear with provision, stay near grief, and recognise gratitude or generosity already present. And when a message needs nothing, Second Word knows when to stay quiet.",
        "GUARD  /  GUIDE  /  PRESENCE  /  SILENCE",
    ),
    (
        "2:18-2:42", "Prove it is real",
        "Cut briefly to the live Worker health response naming Gloo. Show the deployed preflight passing: Verse of the Day, Guard, Guide, Silence, Rewrite and tamper rejection. Flash the 239-test result and nine supported extension surfaces.",
        "This is a working extension and public demo. Drafts are not stored. Requests are bounded. Gloo is live behind a protected allowance. Every passage is verified at runtime, and every result says which provider actually ran.",
        "239 TESTS  /  LIVE GLOO  /  VERIFIED YOUVERSION SCRIPTURE  /  9 SURFACES",
    ),
    (
        "2:42-3:00", "The impact",
        "Return to the composer. The original angry reply becomes truthful and gracious without losing its point. The person sends it. End on the Second Word mark and wordmark.",
        "Across work, public conversation and private life, Scripture can meet people in the place they were already about to speak. Sometimes the Word guards what could wound. Sometimes it reminds us what is already good. Second Word. The Word, living in your text box.",
        "SECOND WORD<br/>Scripture in the space between reaction and response.<br/>Powered by Gloo AI Studio and the YouVersion Platform API.",
    ),
]


def cover_page(canvas, doc):
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(CLAY)
    canvas.setLineWidth(1)
    canvas.line(0.8 * inch, 0.75 * inch, width - 0.8 * inch, 0.75 * inch)
    canvas.restoreState()


def content_page(canvas, doc):
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(RULE)
    canvas.line(0.65 * inch, height - 0.53 * inch, width - 0.65 * inch, height - 0.53 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.65 * inch, height - 0.38 * inch, "SECOND WORD  /  FINAL PRODUCT FILM")
    canvas.drawRightString(width - 0.65 * inch, 0.38 * inch, f"SECOND WORD  |  {doc.page}")
    canvas.restoreState()


def page_chrome(canvas, doc):
    if doc.page == 1:
        cover_page(canvas, doc)
    else:
        content_page(canvas, doc)


doc = BaseDocTemplate(
    str(OUTPUT), pagesize=letter, rightMargin=0.7 * inch, leftMargin=0.7 * inch,
    topMargin=0.72 * inch, bottomMargin=0.62 * inch,
    title="Second Word - Final Three-Minute Product Film",
    author="Second Word",
)
body_frame = Frame(0.7 * inch, 0.62 * inch, 7.1 * inch, 9.45 * inch, id="body", showBoundary=0)
doc.addPageTemplates([PageTemplate(id="All", frames=[body_frame], onPage=page_chrome)])

story = [
    Spacer(1, 1.15 * inch),
    Paragraph("SCRIPTURE IN NEW FRONTIERS", cover_eyebrow),
    Spacer(1, 0.3 * inch),
    Paragraph("Second Word", cover_title),
    Paragraph("Final Three-Minute Product Film", cover_subtitle),
    Spacer(1, 1.05 * inch),
    Paragraph("Other writing tools ask whether your sentence is correct.<br/>Second Word asks what kind of human moment this is.", ParagraphStyle(
        "cover_thesis", parent=cover_subtitle, fontName="Times-Roman", fontSize=20,
        leading=28, textColor=WHITE,
    )),
    Spacer(1, 1.3 * inch),
    Paragraph("RUNTIME  2:55-3:00", cover_eyebrow),
    Spacer(1, 0.12 * inch),
    Paragraph("Urgent at first. Then quiet, human and hopeful.", cover_subtitle),
    PageBreak(),
    Spacer(1, 0.22 * inch),
]

for index, (timecode, title, visuals, voiceover, extra) in enumerate(SECTIONS):
    block = [
        Paragraph(timecode, section_kicker),
        Paragraph(title, section_title),
        Paragraph("VISUAL", label),
        Paragraph(visuals, body),
        Paragraph("VOICEOVER", label),
        Paragraph(f'“{voiceover}”', voice),
    ]
    if extra:
        block.extend([Paragraph("ON SCREEN / SOUND", label), Paragraph(extra, onscreen)])
    story.extend(block)
    if index < len(SECTIONS) - 1:
        story.append(PageBreak())
        story.append(Spacer(1, 0.22 * inch))

story.extend([
    PageBreak(),
    Spacer(1, 0.22 * inch),
    Paragraph("RECORDING RULES", section_kicker),
    Paragraph("Keep the film true to the product", section_title),
    Paragraph("1. Use the public experience at https://second-word.pages.dev.", body),
    Paragraph("2. Record one continuous live Guard interaction. Use cuts only for the faster montage.", body),
    Paragraph("3. Keep the real provider statement visible long enough to read.", body),
    Paragraph("4. Do not show YouVersion Highlights, prayer buttons, emotion scores, a dashboard or automatic sending. None are part of this demo.", body),
    Paragraph("5. Keep the final edit at or below 3:00 and verify the uploaded link while logged out.", body),
    Spacer(1, 0.35 * inch),
    Paragraph("FINAL PROOF SHOT", label),
    Paragraph("REQUIRE_GLOO=1 npm run preflight", onscreen),
    Spacer(1, 0.3 * inch),
    Paragraph("The film sells one idea: Scripture arrives inside the human moment without taking the person's voice away.", ParagraphStyle(
        "closing", parent=voice, fontSize=16, leading=23, leftIndent=0, textColor=INK,
    )),
])

doc.build(story)
copyfile(OUTPUT, HANDOFF)
print(OUTPUT)
print(HANDOFF)
