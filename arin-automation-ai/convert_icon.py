from PIL import Image
import os
import sys

# Path to the generated logo
src_path = r'C:\Users\66990\.gemini\antigravity\brain\c14ec85b-171b-47d1-b8a3-25b60c590114\arin_automation_logo_1774432733381.png'
base_dir = r'c:\Users\66990\Desktop\autogen_ai\arin-automation-ai\icons'

try:
    print(f"Opening source image: {src_path}")
    img = Image.open(src_path).convert('RGBA')
    
    os.makedirs(base_dir, exist_ok=True)
    
    print("Saving 128x128 icon...")
    img.resize((128, 128)).save(os.path.join(base_dir, 'icon128.png'), 'PNG')
    
    print("Saving 48x48 icon...")
    img.resize((48, 48)).save(os.path.join(base_dir, 'icon48.png'), 'PNG')
    
    print("Saving 16x16 icon...")
    img.resize((16, 16)).save(os.path.join(base_dir, 'icon16.png'), 'PNG')
    
    print("Logo converted successfully to PNG format")
except Exception as e:
    print(f"Error converting image: {e}")
    sys.exit(1)
