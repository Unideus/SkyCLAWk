import re

file = '/home/unideus/.openclaw/workspace/app-skyclock/app-timeline/index.html'
with open(file, 'r') as f:
    lines = f.readlines()

# Find the president section (lines 355-516 approximately)
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'President Thumbnails' in line:
        start_line = i
    if start_line and '</script>' in line and i > start_line + 100:
        end_line = i
        break

print(f"Found section from line {start_line} to {end_line}")

# New president section
new_section = '''\t\t<!-- President Thumbnails - Fixed to bottom of viewport with overlapping -->
\t\t<div id="presidentThumbContainer" style="position: fixed; bottom: 10px; left: 0; width: 100%; height: 72px; z-index: 1000; pointer-events: none;">
\t\t\t<img id="trump1Thumb" src="images/trump1-portrait.jpg" alt="Trump (2017-2021)" style="position: absolute; bottom: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center; pointer-events: auto;">
\t\t\t<img id="bidenThumb" src="images/biden-portrait.jpg" alt="Biden" style="position: absolute; bottom: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center; pointer-events: auto;">
\t\t\t<img id="trumpThumb" src="images/trump-portrait.jpg" alt="Trump" style="position: absolute; bottom: 0; width: 60px; height: 72px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, width 0.2s, height 0.2s; transform-origin: bottom center; pointer-events: auto;">
\t\t</div>

\t\t<script>
\t\t\t// President thumbnails - each positioned at start of term with overlapping
\t\t\tconst PRESIDENTS = [
\t\t\t\t{ id: 'trump1Thumb', termStart: 2017 },
\t\t\t\t{ id: 'bidenThumb', termStart: 2021 },
\t\t\t\t{ id: 'trumpThumb', termStart: 2025 }
\t\t\t];
\t\t\t
\t\t\tfunction getPresidentScreenX(targetYear) {
\t\t\t\tif (typeof yearToScrewX !== 'function') return null;
\t\t\t\t
\t\t\t\tconst presidentScrewX = yearToScrewX(targetYear);
\t\t\t\t
\t\t\t\tlet currentScrollX = 0;
\t\t\t\tif (typeof timeState !== 'undefined' && timeState.scrollX !== undefined) {
\t\t\t\t\tcurrentScrollX = timeState.scrollX;
\t\t\t\t}
\t\t\t\t
\t\t\t\tif (typeof getNowScreenX !== 'function' || typeof SCREW_EPOCH_X === 'undefined') return null;
\t\t\t\t
\t\t\t\tconst nowX = getNowScreenX();
\t\t\t\tconst offsetFromEpoch = presidentScrewX - SCREW_EPOCH_X;
\t\t\t\t// Offset to correct alignment
\t\t\t\tconst alignmentOffset = 6 * 5; // 6 years * 5 px/year = 30px
\t\t\t\tconst screenX = nowX + offsetFromEpoch + currentScrollX + alignmentOffset;
\t\t\t\t
\t\t\t\treturn screenX;
\t\t\t}
\t\t\t
\t\t\tfunction updatePresidentPositions() {
\t\t\t\tconst screwRect = document.getElementById('screwSVG')?.getBoundingClientRect();
\t\t\t\tif (!screwRect) return;
\t\t\t\t
\t\t\t\tPRESIDENTS.forEach((pres) => {
\t\t\t\t\tconst thumb = document.getElementById(pres.id);
\t\t\t\t\tconst screenX = getPresidentScreenX(pres.termStart);
\t\t\t\t\t
\t\t\t\t\tif (thumb && screenX !== null) {
\t\t\t\t\t\t// Position left edge at term start
\t\t\t\t\t\tthumb.style.left = (screwRect.left + screenX) + 'px';
\t\t\t\t\t}
\t\t\t\t});
\t\t\t}
\t\t\t
\t\t\t// Smooth animation loop
\t\t\tfunction animatePresidents() {
\t\t\t\tupdatePresidentPositions();
\t\t\t\trequestAnimationFrame(animatePresidents);
\t\t\t}
\t\t\tanimatePresidents();
\t\t\t
\t\t\t// Update on resize
\t\t\twindow.addEventListener('resize', updatePresidentPositions);
\t\t\t
\t\t\t// Hover effects
\t\t\tfunction setupHover(thumb) {
\t\t\t\tif (!thumb) return;
\t\t\t\tthumb.addEventListener('mouseenter', () => {
\t\t\t\t\tthumb.style.width = '90px';
\t\t\t\t\tthumb.style.height = '108px';
\t\t\t\t\tthumb.style.transform = 'translateY(-18px)';
\t\t\t\t\tthumb.style.zIndex = '1001';
\t\t\t\t});
\t\t\t\tthumb.addEventListener('mouseleave', () => {
\t\t\t\t\tthumb.style.width = '60px';
\t\t\t\t\tthumb.style.height = '72px';
\t\t\t\t\tthumb.style.transform = 'translateY(0)';
\t\t\t\t\tthumb.style.zIndex = '1';
\t\t\t\t});
\t\t\t}
\t\t\t
\t\t\tPRESIDENTS.forEach(pres => setupHover(document.getElementById(pres.id)));
\t\t\t
\t\t\t// Initial position
\t\t\tsetTimeout(updatePresidentPositions, 100);
\t\t</script>

'''

if start_line and end_line:
    new_lines = lines[:start_line] + [new_section] + lines[end_line+1:]
    with open(file, 'w') as f:
        f.writelines(new_lines)
    print('Replaced successfully')
else:
    print('Could not find section')
