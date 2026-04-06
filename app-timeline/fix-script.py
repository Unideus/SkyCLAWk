import re

file = '/home/unideus/.openclaw/workspace/app-skyclock/app-timeline/index.html'
with open(file, 'r') as f:
    content = f.read()

# Pattern to match the entire old script
old_script = r'''<script>
\t\t\t// Trump thumbnail positioning - syncs to year 2024 on the timeline
\t\t\tconst TRUMP_TARGET_YEAR = 2024;
\t\t\tlet trumpAnimFrameId = null;
\t\t\t
\t\t\tfunction getTrumpScreenX\(\) \{[^}]+\}
\t\t\t
\t\t\tfunction updateTrumpPosition\(\) \{[^}]+\}
\t\t\t
\t\t\t// Smooth animation loop using requestAnimationFrame
\t\t\tfunction animateTrump\(\) \{[^}]+\}
\t\t\t
\t\t\t// Start animation loop
\t\t\tanimateTrump\(\);
\t\t\t
\t\t\t// Also update on resize
\t\t\twindow\.addEventListener\('resize', updateTrumpPosition\);
\t\t\t
\t\t\t// Hover effects
\t\t\tconst trumpThumb = document\.getElementById\('trumpThumb'\);
\t\t\tconst bidenThumb = document\.getElementById\('bidenThumb'\);
\t\t\tconst trump1Thumb = document\.getElementById\('trump1Thumb'\);
\t\t\tif \(trumpThumb\) \{[^}]+\}
\t\t\tif \(bidenThumb\) \{[^}]+\}
\t\t\tif \(trump1Thumb\) \{[^}]+\}
\t\t\t
\t\t\t// Initial position
\t\t\tsetTimeout\(updateTrumpPosition, 100\);
\t\t</script>'''

new_script = '''<script>
			// President thumbnails - each positioned at start of term with overlapping
			const PRESIDENTS = [
				{ id: 'trump1Thumb', termStart: 2017 },
				{ id: 'bidenThumb', termStart: 2021 },
				{ id: 'trumpThumb', termStart: 2025 }
			];
			
			function getPresidentScreenX(targetYear) {
				if (typeof yearToScrewX !== 'function') return null;
				
				const presidentScrewX = yearToScrewX(targetYear);
				
				let currentScrollX = 0;
				if (typeof timeState !== 'undefined' && timeState.scrollX !== undefined) {
					currentScrollX = timeState.scrollX;
				}
				
				if (typeof getNowScreenX !== 'function' || typeof SCREW_EPOCH_X === 'undefined') return null;
				
				const nowX = getNowScreenX();
				const offsetFromEpoch = presidentScrewX - SCREW_EPOCH_X;
				// Offset to correct alignment
				const alignmentOffset = 6 * 5; // 6 years * 5 px/year = 30px
				const screenX = nowX + offsetFromEpoch + currentScrollX + alignmentOffset;
				
				return screenX;
			}
			
			function updatePresidentPositions() {
				const screwRect = document.getElementById('screwSVG')?.getBoundingClientRect();
				if (!screwRect) return;
				
				PRESIDENTS.forEach((pres, index) => {
					const thumb = document.getElementById(pres.id);
					const screenX = getPresidentScreenX(pres.termStart);
					
					if (thumb && screenX !== null) {
						// Position each thumb at its term start
						// Overlap by positioning absolutely within container
						thumb.style.position = 'absolute';
						thumb.style.left = (screwRect.left + screenX - 30) + 'px'; // Center 60px thumb on year
						thumb.style.bottom = '0';
					}
				});
			}
			
			// Smooth animation loop
			function animatePresidents() {
				updatePresidentPositions();
				requestAnimationFrame(animatePresidents);
			}
			animatePresidents();
			
			// Update on resize
			window.addEventListener('resize', updatePresidentPositions);
			
			// Hover effects
			function setupHover(thumb) {
				if (!thumb) return;
				thumb.addEventListener('mouseenter', () => {
					thumb.style.width = '90px';
					thumb.style.height = '108px';
					thumb.style.transform = 'translateY(-18px)';
					thumb.style.zIndex = '1001';
				});
				thumb.addEventListener('mouseleave', () => {
					thumb.style.width = '60px';
					thumb.style.height = '72px';
					thumb.style.transform = 'translateY(0)';
					thumb.style.zIndex = '1';
				});
			}
			
			PRESIDENTS.forEach(pres => setupHover(document.getElementById(pres.id)));
			
			// Initial position
			setTimeout(updatePresidentPositions, 100);
		</script>'''

# Try simpler replacement
content = content.replace(
    '\t\t<script>\n\t\t\t// Trump thumbnail positioning - syncs to year 2024 on the timeline',
    '\t\t<script>\n\t\t\t// President thumbnails - each positioned at start of term with overlapping'
)

print('Updated start')

with open(file, 'w') as f:
    f.write(content)
