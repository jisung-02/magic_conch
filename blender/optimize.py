from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parent.parent
im=Image.open(root/'magic-conch/public/conch.png').convert('RGBA')
im=im.crop(im.getbbox()); im.thumbnail((940,940),Image.Resampling.LANCZOS)
out=Image.new('RGBA',(1000,1000));out.alpha_composite(im,((1000-im.width)//2,(1000-im.height)//2))
out.save(root/'conch-art/conch-master.png',optimize=True)
out.resize((900,900),Image.Resampling.LANCZOS).save(root/'magic-conch/public/conch.png',optimize=True)
