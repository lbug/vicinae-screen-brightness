import math
from PIL import Image, ImageDraw
S = 2048  # draw large, downsample for antialiasing
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([64, 64, S - 64, S - 64], radius=420, fill=(30, 34, 48, 255))
# monitor
d.rounded_rectangle([360, 420, S - 360, 1420], radius=90, fill=(58, 66, 90, 255))
d.rounded_rectangle([430, 490, S - 430, 1350], radius=50, fill=(20, 22, 32, 255))
d.rectangle([924, 1420, 1124, 1600], fill=(58, 66, 90, 255))
d.rounded_rectangle([700, 1580, 1348, 1680], radius=50, fill=(58, 66, 90, 255))
# sun
cx, cy, r = S // 2, 920, 170
sun = (255, 196, 61, 255)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=sun)
for i in range(8):
    a = i * math.pi / 4
    x1, y1 = cx + math.cos(a) * 250, cy + math.sin(a) * 250
    x2, y2 = cx + math.cos(a) * 350, cy + math.sin(a) * 350
    d.line([x1, y1, x2, y2], fill=sun, width=70)
    for x, y in ((x1, y1), (x2, y2)):
        d.ellipse([x - 35, y - 35, x + 35, y + 35], fill=sun)
img.resize((512, 512), Image.LANCZOS).save("assets/icon.png")
