import sys
from PIL import Image, ImageDraw, ImageFont

def generate_icon(output_path):
    # Create a 256x256 image with a transparent background
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw a stylish shield or circle background (Dark Blue)
    draw.ellipse((10, 10, 246, 246), fill=(11, 14, 20), outline=(14, 165, 233), width=10)

    # Draw inner elements (Network / Chain links)
    draw.line((60, 128, 196, 128), fill=(56, 189, 248), width=8)
    draw.line((128, 60, 128, 196), fill=(56, 189, 248), width=8)

    # Nodes
    draw.ellipse((45, 113, 75, 143), fill=(239, 68, 68)) # Red node
    draw.ellipse((181, 113, 211, 143), fill=(239, 68, 68))
    draw.ellipse((113, 45, 143, 75), fill=(239, 68, 68))
    draw.ellipse((113, 181, 143, 211), fill=(16, 185, 129)) # Green node

    # Save as ICO (multiple sizes)
    img.save(output_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])

if __name__ == '__main__':
    generate_icon(sys.argv[1])
