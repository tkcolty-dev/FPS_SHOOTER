#!/usr/bin/env python3
"""Generate the Place Value & Decimals practice test + answer key PDFs."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas

W, H = letter  # 612 x 792
MARGIN = 65
NAVY = HexColor("#1B3A5C")
BLUE = HexColor("#2E6DA4")
CELL_FILL = HexColor("#8FAECF")
CELL_LINE = HexColor("#3E6295")
KEY_BG = HexColor("#DCE6F1")
GRAY = HexColor("#555555")

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


class Doc:
    def __init__(self, path, title_right):
        self.c = canvas.Canvas(path, pagesize=letter)
        self.title_right = title_right
        self.page = 0
        self.y = 0
        self.new_page()

    def header(self):
        c = self.c
        c.setFillColor(NAVY)
        c.rect(0, H - 95, W, 95, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(MARGIN, H - 62, "Place Value & Decimals Practice Test")
        c.setFont("Helvetica", 10)
        right = self.title_right(self.page)
        c.drawRightString(W - MARGIN, H - 60, right)

    def footer(self):
        c = self.c
        c.setStrokeColor(HexColor("#CCCCCC"))
        c.setLineWidth(0.7)
        c.line(MARGIN, 55, W - MARGIN, 55)
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 9)
        c.drawString(MARGIN, 42, "Place Value and Decimals Practice")

    def new_page(self):
        if self.page:
            self.footer()
            self.c.showPage()
        self.page += 1
        self.header()
        self.y = H - 130

    def need(self, h):
        if self.y - h < 80:
            self.new_page()

    def save(self):
        self.footer()
        self.c.save()


def name_date(d):
    c = d.c
    c.setFillColor(black)
    c.setFont("Helvetica", 11)
    c.drawString(MARGIN, d.y, "Name:")
    c.setLineWidth(0.8)
    c.setStrokeColor(black)
    c.line(MARGIN + 38, d.y - 2, MARGIN + 250, d.y - 2)
    c.drawString(MARGIN + 275, d.y, "Date:")
    c.line(MARGIN + 308, d.y - 2, MARGIN + 430, d.y - 2)
    d.y -= 40


def rich_width(c, segs, size):
    w = 0.0
    for txt, mode in segs:
        s = size * 0.62 if mode == "sup" else size
        f = "Helvetica-Bold" if mode == "bold" else "Helvetica"
        w += c.stringWidth(txt, f, s)
    return w


def draw_rich(c, x, y, segs, size=13, color=black):
    """segs: list of (text, mode) where mode is 'n', 'bold', or 'sup'."""
    c.setFillColor(color)
    cx = x
    for txt, mode in segs:
        if mode == "sup":
            s = size * 0.62
            c.setFont("Helvetica", s)
            c.drawString(cx, y + size * 0.38, txt)
            cx += c.stringWidth(txt, "Helvetica", s)
        else:
            f = "Helvetica-Bold" if mode == "bold" else "Helvetica"
            c.setFont(f, size)
            c.drawString(cx, y, txt)
            cx += c.stringWidth(txt, f, size)
    return cx


def question(d, n, segs, size=13):
    c = d.c
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(MARGIN, d.y, f"{n}.")
    draw_rich(c, MARGIN + 28, d.y, segs, size=size)
    d.y -= 30


def blank_line(d, width=260, indent=28):
    c = d.c
    c.setStrokeColor(black)
    c.setLineWidth(0.9)
    c.line(MARGIN + indent, d.y, MARGIN + indent + width, d.y)
    d.y -= 34


def radio_row(d, options, indent=40, gap=None):
    """Horizontal radio options; options are rich-seg lists."""
    c = d.c
    x = MARGIN + indent
    n = len(options)
    if gap is None:
        gap = (W - 2 * MARGIN - indent) / n
    for segs in options:
        c.setStrokeColor(black)
        c.setLineWidth(1)
        c.circle(x + 5, d.y + 4, 5, stroke=1, fill=0)
        draw_rich(c, x + 16, d.y, segs, size=12)
        x += gap
    d.y -= 30


def radio_col(d, options, indent=40, box=False):
    c = d.c
    for segs in options:
        c.setStrokeColor(black)
        c.setLineWidth(1)
        if box:
            c.rect(MARGIN + indent, d.y - 1, 10, 10, stroke=1, fill=0)
        else:
            c.circle(MARGIN + indent + 5, d.y + 4, 5, stroke=1, fill=0)
        draw_rich(c, MARGIN + indent + 18, d.y, segs, size=12)
        d.y -= 24
    d.y -= 8


def grid(c, x, y, shaded=0, cell=13.5):
    """10x10 hundredths grid, top-left at (x, y). Shades first `shaded` cells."""
    c.setLineWidth(0.6)
    for i in range(100):
        r, col = divmod(i, 10)
        cx = x + col * cell
        cy = y - (r + 1) * cell
        if i < shaded:
            c.setFillColor(CELL_FILL)
            c.rect(cx, cy, cell, cell, stroke=0, fill=1)
        c.setStrokeColor(CELL_LINE)
        c.rect(cx, cy, cell, cell, stroke=1, fill=0)
    c.setLineWidth(1.4)
    c.setStrokeColor(CELL_LINE)
    c.rect(x, y - 10 * cell, 10 * cell, 10 * cell, stroke=1, fill=0)


def grids_row(d, counts, cell=13.5, gap=28, indent=28):
    size = 10 * cell
    x = MARGIN + indent
    top = d.y
    for s in counts:
        grid(d.c, x, top, s, cell)
        x += size + gap
    d.y -= size + 34


N = "n"; B = "bold"; S = "sup"

# ---------------------------------------------------------------- test PDF
test_path = os.path.join(OUT_DIR, "Place_Value_Practice_Test.pdf")
d = Doc(test_path, lambda p: f"Page {p}")

def page_start():
    name_date(d)

page_start()

question(d, 1, [("Evaluate.", N)])
draw_rich(d.c, MARGIN + 28, d.y, [("10", N), ("6", S), ("  =", N)], size=14)
blank_line(d, 110, indent=70)
d.y -= 26

question(d, 2, [("Find the missing exponent.", N)])
draw_rich(d.c, MARGIN + 28, d.y, [("10", N)], size=14)
d.c.setStrokeColor(black); d.c.setLineWidth(0.9)
d.c.rect(MARGIN + 46, d.y + 4, 11, 11, stroke=1, fill=0)
draw_rich(d.c, MARGIN + 62, d.y, [(" =  100,000", N)], size=14)
d.y -= 60

question(d, 3, [("Find the value.", N)])
draw_rich(d.c, MARGIN + 28, d.y, [("73 × 10", N), ("4", S), ("  =", N)], size=14)
blank_line(d, 160, indent=90)
d.y -= 26

question(d, 4, [("Which is equivalent to 10 × 10 × 10 × 10 × 10 × 10?", N)])
d.y -= 6
radio_row(d, [[("10", N), ("4", S)], [("10", N), ("6", S)], [("10", N), ("8", S)]], gap=140)

d.new_page(); page_start()

question(d, 5, [("Write 8,000,000 + 300,000 + 20,000 + 700 + 40 + 9 in standard form.", N)], size=12.5)
d.y -= 6
blank_line(d, 330)
d.y -= 20

question(d, 6, [("In 6,284,731, which digit is in the ten-thousands place?", N)])
d.y -= 6
blank_line(d, 220)
d.y -= 20

question(d, 7, [("Which choice writes 24,608 correctly using words?", N)])
d.y -= 4
radio_col(d, [
    [("twenty-four thousand six hundred eight", N)],
    [("twenty-four thousand sixty-eight", N)],
    [("twenty thousand four hundred sixty-eight", N)],
    [("twenty-six thousand four hundred eight", N)],
])
d.y -= 12

question(d, 8, [('How do you write "seven hundred thousand forty-two" using digits?', N)], size=12.5)
d.y -= 6
radio_row(d, [[("700,042", N)], [("700,420", N)], [("720,042", N)], [("700,402", N)]], gap=118)

d.new_page(); page_start()

question(d, 9, [("Write 0.37 as a fraction.", N)])
d.y -= 6
blank_line(d, 220)
d.y -= 24

question(d, 10, [("What decimal number does the model represent? Each large square is 1 whole.", N)], size=12.5)
d.y -= 10
grids_row(d, [100, 100])
grids_row(d, [100, 64])
d.c.setFont("Helvetica-Bold", 12); d.c.setFillColor(black)
d.c.drawString(MARGIN + 400, d.y + 130, "Answer:")
d.c.setLineWidth(0.9); d.c.setStrokeColor(black)
d.c.line(MARGIN + 400, d.y + 108, MARGIN + 400 + 90, d.y + 108)

d.new_page(); page_start()

question(d, 11, [("Shade the models to show 1.36.", N)])
d.y -= 10
grids_row(d, [0, 0])
d.y -= 10

question(d, 12, [("Write sixty-four and twenty-seven hundredths as a decimal number.", N)], size=12.5)
d.y -= 6
blank_line(d, 250)
d.y -= 20

question(d, 13, [("In 58.42, which digit is in the tenths place?", N)])
d.y -= 6
blank_line(d, 200)

d.new_page(); page_start()

question(d, 14, [("Which sign makes the statement true?   ", N), ("47.9  ___  47.90", B)])
d.y -= 6
radio_row(d, [[(">", B)], [("<", B)], [("=", B)]], indent=60, gap=120)
d.y -= 24

question(d, 15, [("Which sign makes the statement true?   ", N), ("7.45  ___  7.54", B)])
d.y -= 6
radio_row(d, [[(">", B)], [("<", B)], [("=", B)]], indent=60, gap=120)
d.y -= 24

question(d, 16, [("Put these numbers in order from least to greatest:  ", N), ("0.62,  0.206,  0.26,  0.602", B)], size=12.5)
d.y -= 6
blank_line(d, 360)

d.new_page(); page_start()

question(d, 17, [("Which decimals are greater than the one shown in the model?  ", N), ("Select all that apply.", B)], size=12)
d.y -= 10
grids_row(d, [100, 100], cell=11.5, gap=22)
grids_row(d, [100, 27], cell=11.5, gap=22)
d.y += 10
# checkboxes for select-all
cbx = MARGIN + 28
for label in ["3.72", "3.27", "3.30", "3.3"]:
    d.c.setStrokeColor(black); d.c.setLineWidth(1)
    d.c.rect(cbx, d.y - 1, 10, 10, stroke=1, fill=0)
    d.c.setFillColor(black); d.c.setFont("Helvetica", 12)
    d.c.drawString(cbx + 16, d.y, label)
    cbx += 110
d.y -= 40

question(d, 18, [("What is 3.746 rounded to the nearest tenth?", N)])
d.y -= 6
blank_line(d, 200)

d.new_page(); page_start()

question(d, 19, [("Maya wants the heaviest pumpkin. Which pumpkin should she choose?", N)], size=12.5)
d.y -= 8
# table
tx, ty = MARGIN + 28, d.y
rows = [("Pumpkin", "Weight (lb)"), ("Orange", "4.82"), ("White", "4.76"), ("Green", "4.89")]
d.c.setFillColor(KEY_BG)
d.c.rect(tx, ty - 4 * 24 + 16, 300, 4 * 24, stroke=0, fill=1)
for i, (a, b) in enumerate(rows):
    yy = ty - i * 24
    d.c.setFillColor(black)
    d.c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 11.5)
    d.c.drawString(tx + 14, yy, a)
    d.c.drawString(tx + 170, yy, b)
d.y = ty - 4 * 24 - 14
radio_row(d, [[("orange", N)], [("white", N)], [("green", N)]], gap=120)
d.y -= 20

question(d, 20, [("Which list shows the runners in order from shortest time to longest time?", N)], size=12.5)
d.c.setFillColor(black); d.c.setFont("Helvetica", 11.5)
d.c.drawString(MARGIN + 28, d.y, "Ava  6.4 sec      Ben  6.04 sec      Cole  6.44 sec")
d.y -= 28
radio_col(d, [[("Ben, Ava, Cole", N)], [("Ava, Ben, Cole", N)], [("Cole, Ava, Ben", N)]])

d.new_page(); page_start()

question(d, 21, [("Are 42.500 and 42.5 equivalent decimals?", N)])
d.y -= 6
radio_row(d, [[("Yes", N)], [("No", N)]], indent=40, gap=110)
d.y -= 18

question(d, 22, [("Complete the sentence:  ______ is 10 times as much as 0.7.", N)], size=12.5)
d.y -= 6
blank_line(d, 200)
d.y -= 12

question(d, 23, [("Complete the sentence:  ______ is 1/10 of 6.3.", N)], size=12.5)
d.y -= 6
blank_line(d, 200)
d.y -= 12

question(d, 24, [("Write the expression using an exponent:  4 × 4 × 4 × 4 × 4", N)], size=12.5)
d.y -= 6
blank_line(d, 200)
d.y -= 12

question(d, 25, [("Evaluate.", N)])
draw_rich(d.c, MARGIN + 28, d.y, [("6", N), ("4", S), ("  =", N)], size=14)
blank_line(d, 130, indent=64)

d.save()

# ---------------------------------------------------------------- answer key
key_path = os.path.join(OUT_DIR, "Place_Value_Practice_Test_Answer_Key.pdf")
k = Doc(key_path, lambda p: f"Answer Key | Page {p}")

ANSWERS = [
    [("1,000,000", N)],
    [("5", N)],
    [("730,000", N)],
    [("10", N), ("6", S)],
    [("8,320,749", N)],
    [("8", N)],
    [("twenty-four thousand six hundred eight", N)],
    [("700,042", N)],
    [("37/100", N)],
    [("3.64", N)],
    [("Shade 1 whole grid and 36 hundredths of the second grid.", N)],
    [("64.27", N)],
    [("4", N)],
    [("=", N)],
    [("<", N)],
    [("0.206,  0.26,  0.602,  0.62", N)],
    [("3.72,  3.30,  and  3.3", N)],
    [("3.7", N)],
    [("Green  (4.89 lb)", N)],
    [("Ben, Ava, Cole", N)],
    [("Yes", N)],
    [("7", N)],
    [("0.63", N)],
    [("4", N), ("5", S)],
    [("1,296", N)],
]

for i, segs in enumerate(ANSWERS, 1):
    k.need(56)
    box_h = 40
    k.c.setFillColor(KEY_BG)
    k.c.roundRect(MARGIN, k.y - box_h + 26, W - 2 * MARGIN, box_h, 8, stroke=0, fill=1)
    draw_rich(k.c, MARGIN + 18, k.y, [(f"{i}.  ", B)] + segs, size=12.5)
    k.y -= box_h + 14

k.save()
print("wrote:", test_path)
print("wrote:", key_path)
