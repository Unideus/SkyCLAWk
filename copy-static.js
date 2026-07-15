#!/usr/bin/env node
// Post-build: copy static assets that Vite doesn't bundle
import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dirname)
const dist = resolve(root, 'dist')

// Copy shared modules (referenced by generational + personal as non-module scripts)
const sharedSrc = resolve(root, 'shared')
const sharedDst = resolve(dist, 'shared')
if (existsSync(sharedSrc)) {
    mkdirSync(sharedDst, { recursive: true })
    cpSync(sharedSrc, sharedDst, { recursive: true })
    console.log('Copied: shared/')
}

// Copy generational js dependencies (vendor, conjunction data, engine files)
const genJsSrc = resolve(root, 'generational/js')
const genJsDst = resolve(dist, 'generational/js')
if (existsSync(genJsSrc)) {
    mkdirSync(genJsDst, { recursive: true })
    cpSync(genJsSrc, genJsDst, { recursive: true })
    console.log('Copied: generational/js/')
}

// Copy personal js dependencies
const perJsSrc = resolve(root, 'personal/js')
const perJsDst = resolve(dist, 'personal/js')
if (existsSync(perJsSrc)) {
    mkdirSync(perJsDst, { recursive: true })
    cpSync(perJsSrc, perJsDst, { recursive: true })
    console.log('Copied: personal/js/')
}

// Copy planting js dependencies
const pltJsSrc = resolve(root, 'planting/js')
const pltJsDst = resolve(dist, 'planting/js')
if (existsSync(pltJsSrc)) {
    mkdirSync(pltJsDst, { recursive: true })
    cpSync(pltJsSrc, pltJsDst, { recursive: true })
    console.log('Copied: planting/js/')
}

// Copy CSS files
const cssSrc = resolve(root, 'css')
const cssDst = resolve(dist, 'css')
if (existsSync(cssSrc)) {
    mkdirSync(cssDst, { recursive: true })
    cpSync(cssSrc, cssDst, { recursive: true })
    console.log('Copied: css/')
}

// Copy data
const dataSrc = resolve(root, 'data')
const dataDst = resolve(dist, 'data')
if (existsSync(dataSrc)) {
    mkdirSync(dataDst, { recursive: true })
    cpSync(dataSrc, dataDst, { recursive: true })
    console.log('Copied: data/')
}

// Copy images
const imgSrc = resolve(root, 'images')
const imgDst = resolve(dist, 'images')
if (existsSync(imgSrc)) {
    mkdirSync(imgDst, { recursive: true })
    cpSync(imgSrc, imgDst, { recursive: true })
    console.log('Copied: images/')
}

// Copy ephe
const epheSrc = resolve(root, 'public/ephe')
const epheDst = resolve(dist, 'ephe')
if (existsSync(epheSrc)) {
    mkdirSync(epheDst, { recursive: true })
    cpSync(epheSrc, epheDst, { recursive: true })
    console.log('Copied: ephe/')
}

// Copy skyclock static dependencies (plain scripts + image assets)
const scDirSrc = resolve(root, 'skyclock')
const scDirDst = resolve(dist, 'skyclock')
if (existsSync(scDirSrc)) {
    mkdirSync(scDirDst, { recursive: true })
    cpSync(scDirSrc, scDirDst, { recursive: true })
    console.log('Copied: skyclock/')
}

// Copy planting CSS
const ptSrc = resolve(root, 'planting/planting.css')
const ptDst = resolve(dist, 'planting/planting.css')
if (existsSync(ptSrc)) {
    cpSync(ptSrc, ptDst)
    console.log('Copied: planting/planting.css')
}

// Copy standalone wheel scripts and CSS. Vite owns wheel/index.html so its
// transformed module references remain intact.
const wheelSrc = resolve(root, 'wheel')
const wheelDst = resolve(dist, 'wheel')
if (existsSync(wheelSrc)) {
    mkdirSync(wheelDst, { recursive: true })
    for (const f of ['wheel-prelude.js', 'wheel-app.js', 'wheel.css']) {
        const src = resolve(wheelSrc, f)
        const dst = resolve(wheelDst, f)
        if (existsSync(src)) cpSync(src, dst)
    }
    console.log('Copied: wheel scripts and CSS')
}

// Copy cosmic-report standalone page assets. Vite builds index.html, while the
// Spanish entry is a separate static document that must be promoted explicitly.
const cosmicSrc = resolve(root, 'cosmic-report')
const cosmicDst = resolve(dist, 'cosmic-report')
if (existsSync(cosmicSrc)) {
    mkdirSync(cosmicDst, { recursive: true })
    for (const f of ['index_es.html', 'cosmic-report.js', 'cosmic-report.css']) {
        const src = resolve(cosmicSrc, f)
        const dst = resolve(cosmicDst, f)
        if (existsSync(src)) cpSync(src, dst)
    }
    console.log('Copied: cosmic-report scripts and CSS')
}

// Copy auspicious WASM + public assets
const ausPublicSrc = resolve(root, 'auspicious/public')
const ausPublicDst = resolve(dist, 'auspicious')
if (existsSync(ausPublicSrc)) {
    // Copy public subdirectories into dist/auspicious/ so Vite-relative paths work
    for (const entry of ['wasm']) {
        const src = resolve(ausPublicSrc, entry)
        const dst = resolve(ausPublicDst, entry)
        if (existsSync(src)) {
            mkdirSync(dst, { recursive: true })
            cpSync(src, dst, { recursive: true })
            console.log('Copied: auspicious/' + entry + '/')
        }
    }
}

// Copy _redirects
const rdSrc = resolve(root, '_redirects')
const rdDst = resolve(dist, '_redirects')
if (existsSync(rdSrc)) {
    cpSync(rdSrc, rdDst)
    console.log('Copied: _redirects')
}


// Copy root-level files (heaven_constellations.svg, timelinetitle.webp)
for (const f of ['heaven_constellations.svg', 'timelinetitle.webp']) {
    const src = resolve(root, f)
    const dst = resolve(dist, f)
    if (existsSync(src)) {
        cpSync(src, dst)
        console.log('Copied: ' + f)
    }
}

console.log('Post-build copy complete!')
