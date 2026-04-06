import re

file = '/home/unideus/.openclaw/workspace/app-skyclock/app-timeline/index.html'
with open(file, 'r') as f:
    content = f.read()

# Update container style
content = content.replace(
    '<div id="presidentThumbContainer" style="position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1000;">',
    '<div id="presidentThumbContainer" style="position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 1000; display: flex; gap: 10px; align-items: flex-end; height: 72px;">'
)

# Wrap trump1
content = content.replace(
    '<img id="trump1Thumb" src="images/trump1-portrait.jpg" alt="Trump (2017-2021)" style="width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s;">',
    '<div style="position: relative; width: 60px; height: 72px;"><img id="trump1Thumb" src="images/trump1-portrait.jpg" alt="Trump (2017-2021)" style="position: absolute; bottom: 0; left: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center;"></div>'
)

# Wrap biden
content = content.replace(
    '<img id="bidenThumb" src="images/biden-portrait.jpg" alt="Biden" style="width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s;">',
    '<div style="position: relative; width: 60px; height: 72px;"><img id="bidenThumb" src="images/biden-portrait.jpg" alt="Biden" style="position: absolute; bottom: 0; left: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center;"></div>'
)

# Wrap trump
content = content.replace(
    '<img id="trumpThumb" src="images/trump-portrait.jpg" alt="Trump" style="width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s;">',
    '<div style="position: relative; width: 60px; height: 72px;"><img id="trumpThumb" src="images/trump-portrait.jpg" alt="Trump" style="position: absolute; bottom: 0; left: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center;"></div>'
)

with open(file, 'w') as f:
    f.write(content)

print('Updated')
