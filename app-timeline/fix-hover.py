import re

file = '/home/unideus/.openclaw/workspace/app-skyclock/app-timeline/index.html'
with open(file, 'r') as f:
    content = f.read()

old_section = '''\t\t\t// Hover effects
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
\t\t\tPRESIDENTS.forEach(pres => setupHover(document.getElementById(pres.id)));'''

new_section = '''\t\t\t// Hover effects - show label and expand thumb
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
\t\t\t});'''

content = content.replace(old_section, new_section)

with open(file, 'w') as f:
    f.write(content)

print('Done')
