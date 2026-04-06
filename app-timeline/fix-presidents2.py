import re

file = '/home/unideus/.openclaw/workspace/app-skyclock/app-timeline/index.html'
with open(file, 'r') as f:
    content = f.read()

# Find and replace the entire presidents script section
old_script = r'''\t\t<script>
\t\t\t// President thumbnails - each positioned at start of term with overlapping
\t\t\tconst PRESIDENTS = \[
\t\t\t\t{ id: 'trump1Container', thumbId: 'trump1Thumb', labelId: 'trump1Label', termStart: 2017 },
\t\t\t\t{ id: 'bidenContainer', thumbId: 'bidenThumb', labelId: 'bidenLabel', termStart: 2021 },
\t\t\t\t{ id: 'trumpContainer', thumbId: 'trumpThumb', labelId: 'trumpLabel', termStart: 2025 }
\t\t\t\t{ id: 'trump1Thumb', termStart: 2017 },
\t\t\t\t{ id: 'bidenThumb', termStart: 2021 },
\t\t\t\t{ id: 'trumpThumb', termStart: 2025 }
\t\t\t\];
\t\t\t
\t\t\tfunction getPresidentScreenX\(targetYear\) \{[^}]+\}
\t\t\t
\t\t\tfunction updatePresidentPositions\(\) \{[^}]+\}
\t\t\t
\t\t\t// Smooth animation loop
\t\t\tfunction animatePresidents\(\) \{[^}]+\}
\t\t\tanimatePresidents\(\);
\t\t\t
\t\t\t// Update on resize
\t\t\twindow\.addEventListener\('resize', updatePresidentPositions\);
\t\t\t
\t\t\t// Hover effects
\t\t\tfunction setupHover\(thumb\) \{[^}]+\}
\t\t\t
\t\t\tPRESIDENTS\.forEach\(pres => setupHover\(document\.getElementById\(pres\.id\)\)\);
\t\t\t
\t\t\t// Initial position
\t\t\tsetTimeout\(updatePresidentPositions, 100\);
\t\t</script>'''

new_script = '''\t\t<script>
\t\t\t// President thumbnails - each positioned at start of term with overlapping
\t\t\tconst PRESIDENTS = [
\t\t\t\t{ id: 'trump1Container', thumbId: 'trump1Thumb', labelId: 'trump1Label', termStart: 2017 },
\t\t\t\t{ id: 'bidenContainer', thumbId: 'bidenThumb', labelId: 'bidenLabel', termStart: 2021 },
\t\t\t\t{ id: 'trumpContainer', thumbId: 'trumpThumb', labelId: 'trumpLabel', termStart: 2025 }
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
\t\t\t\tconst screenX = nowX + offsetFromEpoch + currentScrollX;
\t\t\t\t
\t\t\t\treturn screenX;
\t\t\t}
\t\t\t
\t\t\tfunction updatePresidentPositions() {
\t\t\t\tconst screwRect = document.getElementById('screwSVG')?.getBoundingClientRect();
\t\t\t\tif (!screwRect) return;
\t\t\t\t
\t\t\t\tPRESIDENTS.forEach((pres) => {
\t\t\t\t\tconst container = document.getElementById(pres.id);
\t\t\t\t\tconst screenX = getPresidentScreenX(pres.termStart);
\t\t\t\t\t
\t\t\t\t\tif (container && screenX !== null) {
\t\t\t\t\t\tcontainer.style.left = (screwRect.left + screenX) + 'px';
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
\t\t\t// Hover effects - show label and expand thumb
\t\t\tPRESIDENTS.forEach((pres) => {
\t\t\t\tconst container = document.getElementById(pres.id);
\t\t\t\tconst thumb = document.getElementById(pres.thumbId);
\t\t\t\tconst label = document.getElementById(pres.labelId);
\t\t\t\t
\t\t\t\tif (!container || !thumb) return;
\t\t\t\t
\t\t\t\tcontainer.addEventListener('mouseenter', () => {
\t\t\t\t\tthumb.style.width = '90px';
\t\t\t\t\tthumb.style.height = '108px';
\t\t\t\t\tthumb.style.transform = 'translateY(-18px)';
\t\t\t\t\tthumb.style.zIndex = '1001';
\t\t\t\t\tif (label) label.style.opacity = '1';
\t\t\t\t});
\t\t\t\t
\t\t\t\tcontainer.addEventListener('mouseleave', () => {
\t\t\t\t\tthumb.style.width = '60px';
\t\t\t\t\tthumb.style.height = '72px';
\t\t\t\t\tthumb.style.transform = 'translateY(0)';
\t\t\t\t\tthumb.style.zIndex = '1';
\t\t\t\t\tif (label) label.style.opacity = '0';
\t\t\t\t});
\t\t\t});
\t\t\t
\t\t\t// Initial position
\t\t\tsetTimeout(updatePresidentPositions, 100);
\t\t</script>'''

# Simple string replacement approach
content = content.replace(
    '\t\t\t\t{ id: \'trump1Container\', thumbId: \'trump1Thumb\', labelId: \'trump1Label\', termStart: 2017 },\n\t\t\t\t{ id: \'bidenContainer\', thumbId: \'bidenThumb\', labelId: \'bidenLabel\', termStart: 2021 },\n\t\t\t\t{ id: \'trumpContainer\', thumbId: \'trumpThumb\', labelId: \'trumpLabel\', termStart: 2025 }\n\t\t\t\t{ id: \'trump1Thumb\', termStart: 2017 },\n\t\t\t\t{ id: \'bidenThumb\', termStart: 2021 },\n\t\t\t\t{ id: \'trumpThumb\', termStart: 2025 }',
    '\t\t\t\t{ id: \'trump1Container\', thumbId: \'trump1Thumb\', labelId: \'trump1Label\', termStart: 2017 },\n\t\t\t\t{ id: \'bidenContainer\', thumbId: \'bidenThumb\', labelId: \'bidenLabel\', termStart: 2021 },\n\t\t\t\t{ id: \'trumpContainer\', thumbId: \'trumpThumb\', labelId: \'trumpLabel\', termStart: 2025 }'
)

# Now replace the updatePresidentPositions function and hover logic
content = content.replace(
    'const thumb = document.getElementById(pres.id);',
    'const container = document.getElementById(pres.id);'
)

content = content.replace(
    'if (thumb && screenX !== null) {\n\t\t\t\t\t\t// Position left edge at term start\n\t\t\t\t\t\tthumb.style.left = (screwRect.left + screenX) + \'px\';\n\t\t\t\t\t}',
    'if (container && screenX !== null) {\n\t\t\t\t\t\tcontainer.style.left = (screwRect.left + screenX) + \'px\';\n\t\t\t\t\t}'
)

with open(file, 'w') as f:
    f.write(content)

print('Fixed')
