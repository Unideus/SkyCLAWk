#!/usr/bin/env python3
"""Generate a standalone Cosmic Snapshot page (page 3 of the report).

HTML/WeasyPrint-based — visually striking, scannable, designed to be screenshotted.
Key aspect boxes match the chart page's planet box style (rect, pastel fill, colored border).

Usage:
    source ~/.hermes/hermes-agent/venv/bin/activate
    python3 scripts/generate_snapshot_page.py --year 1969 --month 8 --day 21 --hour 13 --min 30 --tz COT --lat 5.34 --lon -72.40 --location "Yopal, Casanare, Colombia" --name "Astrid Restrepo" --output snapshot_astrid.pdf
"""

import os, sys, math, argparse
import swisseph as swe
from weasyprint import HTML

CHART_PAGE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CHART_PAGE_DIR)
from generate_chart_page import calculate_hellenistic_rulers

# ── Swiss Ephemeris setup ───────────────────────────────────────────────────
EPHE_PATH = '/mnt/e/Hermes Project/GitHub/Timeline_ARCHIVED/app-timeline/public/ephe'
swe.set_ephe_path(EPHE_PATH)

SWE_BODIES = {
    "Sun": swe.SUN, "Moon": swe.MOON,
    "Mercury": swe.MERCURY, "Venus": swe.VENUS, "Mars": swe.MARS,
    "Jupiter": swe.JUPITER, "Saturn": swe.SATURN,
    "Uranus": swe.URANUS, "Neptune": swe.NEPTUNE, "Pluto": swe.PLUTO,
    "N.Node": swe.MEAN_NODE,
}

GLYPHS = {"Sun":"☉","Moon":"☽","Mercury":"☿","Venus":"♀","Mars":"♂","Jupiter":"♃","Saturn":"♄","Uranus":"♅","Neptune":"♆","Pluto":"♇","N.Node":"☊"}
SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"]
ELEMENTS = {"Aries":"Fire","Taurus":"Earth","Gemini":"Air","Cancer":"Water","Leo":"Fire","Virgo":"Earth","Libra":"Air","Scorpio":"Water","Sagittarius":"Fire","Capricorn":"Earth","Aquarius":"Air","Pisces":"Water"}
QUALITIES = {"Aries":"Cardinal","Taurus":"Fixed","Gemini":"Mutable","Cancer":"Cardinal","Leo":"Fixed","Virgo":"Mutable","Libra":"Cardinal","Scorpio":"Fixed","Sagittarius":"Mutable","Capricorn":"Cardinal","Aquarius":"Fixed","Pisces":"Mutable"}
ELEMENT_COLORS = {"Fire":"#d32f2f","Earth":"#2e7d32","Air":"#fbc02d","Water":"#1976d2"}
PASTEL = {"#d32f2f":"#f5d0d0","#2e7d32":"#d0e8d0","#fbc02d":"#f5ecd0","#1976d2":"#d0dcef"}
# Pre-lightened element colors for sign glyph watermark (~25% intensity, no opacity needed)
LIGHT_ELEMENT = {"#d32f2f":"#f4cbcb","#2e7d32":"#cbdecc","#fbc02d":"#feefca","#1976d2":"#c5ddf4"}

# ── Glyph paths extracted from FreeSerif.ttf via fontTools SVGPathPen ──
# Actual vector outlines: no font matching, no emoji hijacking, no dotted circles.
# Each path is in font units (~0–1000). Use glyph_svg() to scale/position.

SIGN_PATHS = {
    'Aries': dict(d='M622 575Q622 543 605.0 515.5Q588 488 557 488Q538 488 523.5 504.5Q509 521 509 540Q509 558 527.0 578.5Q545 599 545 609Q545 620 531.5 625.5Q518 631 504 631Q463 631 432.0 594.0Q401 557 386.0 501.0Q371 445 364.0 394.0Q357 343 357 299V0H273V299Q273 343 266.0 394.0Q259 445 244.0 501.0Q229 557 198.0 594.0Q167 631 126 631Q112 631 98.5 625.5Q85 620 85 609Q85 599 103.0 578.5Q121 558 121 540Q121 521 106.5 504.5Q92 488 73 488Q42 488 25.0 515.5Q8 543 8 575Q8 612 36.5 642.0Q65 672 101 672Q249 672 315 425Q381 672 529 672Q565 672 593.5 642.0Q622 612 622 575Z', bbox=(8, 0, 622, 672)),
    'Taurus': dict(d='M115 275Q115 168 154.0 93.0Q193 18 256 18Q312 18 344.0 66.0Q376 114 376 199Q376 302 336.0 367.0Q296 432 233 432Q180 432 147.5 389.0Q115 346 115 275ZM199 455Q172 464 147.0 478.5Q122 493 99.0 514.5Q76 536 61.5 567.0Q47 598 46 634H75Q85 586 141.0 546.5Q197 507 247.0 507.0Q297 507 353.0 546.5Q409 586 419 634H448Q447 598 432.5 567.0Q418 536 395.0 514.0Q372 492 346.5 477.5Q321 463 295 455Q372 439 419.0 379.0Q466 319 466 234Q466 130 402.0 60.0Q338 -10 244.0 -10.0Q150 -10 87.5 57.5Q25 125 25 226Q25 316 72.5 378.0Q120 440 199 455Z', bbox=(25, -10, 466, 634)),
    'Gemini': dict(d='M393 109V553Q393 608 376.5 623.5Q360 639 296 643Q233 640 215.5 624.0Q198 608 198 553V109Q198 54 216.0 37.5Q234 21 296 19Q359 21 376.0 37.0Q393 53 393 109ZM113 109V553Q113 608 96.0 623.5Q79 639 15 643V662H575V643Q512 640 494.5 624.0Q477 608 477 553V109Q477 54 495.0 37.5Q513 21 575 19V0H15V19Q78 21 95.5 37.0Q113 53 113 109Z', bbox=(15, 0, 575, 662)),
    'Cancer': dict(d='M149 367Q215 367 264.0 397.5Q313 428 313 477Q313 521 278.0 547.0Q243 573 194 573Q134 573 88.0 542.0Q42 511 42 464Q42 414 73.0 390.5Q104 367 149 367ZM290 579Q350 545 350 471Q350 401 300.5 346.5Q251 292 172 292Q102 292 54.5 343.0Q7 394 7 469Q7 519 27.5 556.0Q48 593 85.0 615.0Q122 637 169.0 647.5Q216 658 273 658Q384 658 497.0 621.0Q610 584 691 532L673 495Q607 526 493.5 552.5Q380 579 290 579ZM543 309Q477 309 428.0 278.5Q379 248 379 199Q379 155 414.0 129.0Q449 103 498 103Q558 103 604.0 134.0Q650 165 650 212Q650 262 619.0 285.5Q588 309 543 309ZM402 97Q342 131 342 205Q342 275 391.5 329.5Q441 384 520 384Q590 384 637.5 333.0Q685 282 685 207Q685 157 664.5 120.0Q644 83 607.0 61.0Q570 39 523.0 28.5Q476 18 419 18Q309 18 201.5 54.5Q94 91 11 144L29 181Q94 150 207.0 123.5Q320 97 402 97Z', bbox=(6, 17, 691, 659)),
    'Leo': dict(d='M229 161Q229 174 215.5 209.0Q202 244 188.0 304.5Q174 365 174 439Q174 532 247.0 604.0Q320 676 425 676Q538 676 603.5 607.0Q669 538 669 443Q669 387 647.5 336.0Q626 285 601.0 253.0Q576 221 554.5 174.0Q533 127 533 78Q533 28 559.0 -24.0Q585 -76 632 -76Q662 -76 683.5 -61.0Q705 -46 705 -17Q705 2 668 2Q649 2 630.0 17.0Q611 32 611 55Q611 76 626.5 89.5Q642 103 663 103Q702 103 730.0 72.5Q758 42 758 2Q758 -53 717.5 -81.5Q677 -110 617 -110Q542 -110 492.5 -61.0Q443 -12 443 57Q443 106 465.0 155.5Q487 205 514.0 241.0Q541 277 563.0 328.0Q585 379 585 430Q585 525 535.5 582.5Q486 640 423.0 640.0Q360 640 309.0 581.0Q258 522 258 437Q258 359 275.0 276.5Q292 194 292 138Q292 76 255.5 38.0Q219 0 154 0Q87 0 50.5 49.0Q14 98 14 214H28Q45 132 74.5 108.0Q104 84 152 84Q229 84 229 161Z', bbox=(14, -110, 758, 676)),
    'Virgo': dict(d='M173 538V0H89V524Q89 568 80.0 585.0Q71 602 47 602Q28 602 8 597V618Q38 626 60.0 633.5Q82 641 110.5 653.0Q139 665 159 672L168 670V579Q248 640 278.0 656.0Q308 672 346 672Q392 672 410.0 650.5Q428 629 447 570Q497 624 540.0 648.0Q583 672 635 672Q694 672 718.5 632.5Q743 593 747 506Q817 562 896 562Q961 562 985.0 516.5Q1009 471 1009 386Q1009 256 832 27Q868 -70 915 -160H853Q809 -82 784 -33Q704 -130 634 -198H572Q585 -180 649.0 -100.0Q713 -20 753 35Q664 245 664 476Q664 554 648.5 581.5Q633 609 582 609Q542 609 515.5 592.0Q489 575 460 535V0H376V482Q376 548 360.5 578.5Q345 609 306.0 609.0Q267 609 234.5 593.5Q202 578 187.5 562.0Q173 546 173 538ZM748 466Q748 461 748 456Q748 293 804 110Q925 293 925 406Q925 457 909.0 478.0Q893 499 843 499Q787 499 748 466Z', bbox=(8, -198, 1009, 672)),
    'Libra': dict(d='M650 0H24V52H650ZM25 181H189Q184 188 161.0 215.0Q138 242 124.5 263.5Q111 285 97.5 332.5Q84 380 84 439Q84 532 157.0 604.0Q230 676 335 676Q448 676 513.5 607.0Q579 538 579 443Q579 385 566.5 338.5Q554 292 539.5 269.5Q525 247 505.0 220.5Q485 194 478 181H648V117H413Q427 187 448.5 241.5Q470 296 482.5 334.5Q495 373 495 430Q495 525 445.5 582.5Q396 640 333.0 640.0Q270 640 219.0 581.0Q168 522 168 437Q168 372 179.5 331.5Q191 291 214.0 237.0Q237 183 253 117H25Z', bbox=(24, 0, 650, 676)),
    'Scorpio': dict(d='M173 538V0H89V524Q89 568 80.0 585.0Q71 602 47 602Q28 602 8 597V618Q38 626 60.0 633.5Q82 641 110.5 653.0Q139 665 159 672L168 670V579Q248 640 278.0 656.0Q308 672 346 672Q392 672 410.0 650.5Q428 629 447 570Q497 624 540.0 648.0Q583 672 635 672Q701 672 724.5 621.5Q748 571 748 456Q748 52 805 52Q832 52 856.0 85.5Q880 119 915.0 177.0Q950 235 989 272L853 290L852 335L1085 328L1092 95L1046 97L1029 232Q1006 210 976.5 164.5Q947 119 925.5 83.0Q904 47 871.0 18.5Q838 -10 803 -10Q721 -10 692.5 95.0Q664 200 664 476Q664 554 648.5 581.5Q633 609 582 609Q542 609 515.5 592.0Q489 575 460 535V0H376V482Q376 548 360.5 578.5Q345 609 306.0 609.0Q267 609 234.5 593.5Q202 578 187.5 562.0Q173 546 173 538Z', bbox=(8, -10, 1092, 672)),
    'Sagittarius': dict(d='M172 127 257 43Q257 43 217 3L132 88L53 9L14 48L93 127L8 212L48 252L132 167L520 555L334 573L333 618L616 612L623 328L578 329L560 515Z', bbox=(7, 2, 623, 618)),
    'Capricorn': dict(d='M322 372Q276 372 241.5 325.0Q207 278 207 223Q207 136 246.0 75.0Q285 14 349 14Q402 14 430.0 58.5Q458 103 458 185Q458 278 422.5 325.0Q387 372 322 372ZM41 144 23 181Q75 259 129 307Q134 385 179.5 462.5Q225 540 291 588H163Q122 588 100.5 573.0Q79 558 47 507L30 515L89 662H449V646Q382 624 316.0 554.5Q250 485 232 383Q294 428 360 428Q445 428 491.5 372.0Q538 316 538 219Q538 114 484.0 50.0Q430 -14 338 -14Q247 -14 193.0 55.5Q139 125 130 243Q85 204 41 144Z', bbox=(23, -14, 538, 662)),
    'Aquarius': dict(d='M727 12Q683 12 648.5 37.0Q614 62 597.0 91.5Q580 121 558.0 146.0Q536 171 513 171Q496 171 478.5 155.0Q461 139 445.0 116.5Q429 94 410.5 71.0Q392 48 365.0 32.0Q338 16 306 16Q268 16 237.5 42.5Q207 69 190.5 100.5Q174 132 151.5 158.5Q129 185 105 185Q59 185 30 121L11 131Q28 226 105 226Q139 226 166.5 208.5Q194 191 212.0 166.0Q230 141 245.5 116.5Q261 92 276.5 74.5Q292 57 308 57Q329 57 349.0 81.0Q369 105 385.5 134.0Q402 163 436.0 187.0Q470 211 516 211Q554 211 587.0 186.0Q620 161 639.5 131.5Q659 102 682.5 77.0Q706 52 726 52Q751 52 766.0 62.0Q781 72 797 107L817 97Q802 12 727 12ZM727 232Q683 232 649.0 257.0Q615 282 597.5 311.5Q580 341 558.0 366.0Q536 391 513 391Q496 391 478.5 375.0Q461 359 444.5 336.5Q428 314 409.5 291.0Q391 268 364.0 252.0Q337 236 306 236Q268 236 237.5 262.5Q207 289 190.5 320.5Q174 352 151.5 378.5Q129 405 105 405Q79 405 63.0 391.5Q47 378 30 341L11 351Q28 446 105 446Q140 446 168.0 428.5Q196 411 214.0 386.5Q232 362 246.5 337.0Q261 312 276.5 294.5Q292 277 308 277Q329 277 349.0 301.0Q369 325 385.5 354.0Q402 383 436.0 407.0Q470 431 516 431Q554 431 587.5 406.0Q621 381 641.0 351.5Q661 322 684.0 297.0Q707 272 726 272Q754 272 767.5 281.5Q781 291 797 327L817 317Q802 232 727 232Z', bbox=(11, 12, 817, 446)),
    'Pisces': dict(d='M30 307V373H148Q145 475 116.5 540.5Q88 606 19 660L31 676Q60 658 90.0 632.0Q120 606 151.5 568.0Q183 530 205.0 479.0Q227 428 233 373H369Q374 428 395.5 478.0Q417 528 449.5 565.5Q482 603 511.5 628.5Q541 654 575 676L584 660Q513 603 485.0 539.0Q457 475 454 373H564V307H454Q458 195 485.5 130.0Q513 65 584 9L572 -7Q541 12 512.0 37.0Q483 62 451.0 100.0Q419 138 397.0 192.0Q375 246 369 307H234Q231 257 215.0 212.0Q199 167 179.0 135.5Q159 104 130.0 74.5Q101 45 78.5 28.0Q56 11 28 -7L19 9Q91 67 118.5 132.0Q146 197 149 307Z', bbox=(19, -7, 584, 676)),
}

PLANET_PATHS = {
    'Sun': dict(d='M401 676Q262 676 164.5 581.0Q67 486 67 350Q67 212 163.0 115.0Q259 18 396 18Q532 18 628.5 114.5Q725 211 725 347Q725 482 629.0 579.0Q533 676 401 676ZM402 717Q551 717 658.5 608.5Q766 500 766 347Q766 196 657.0 86.5Q548 -23 396 -23Q240 -23 133.0 84.0Q26 191 26 350Q26 504 135.5 610.5Q245 717 402 717ZM399.25 419.25Q428.0 419.25 448.625 398.0Q469.25 376.75 469.25 348.0Q469.25 320.5 448.0 300.5Q426.75 280.5 398.0 280.5Q370.5 280.5 350.5 300.5Q330.5 320.5 330.5 348.0Q330.5 376.75 351.125 398.0Q371.75 419.25 399.25 419.25Z', bbox=(26, -23, 766, 717)),
    'Moon': dict(d='M387 671Q477 526 477 360Q477 190 374 38Q410 45 452.0 70.5Q494 96 533.5 135.5Q573 175 599.0 234.0Q625 293 625 357Q625 481 551.5 565.0Q478 649 387 671ZM302 727Q451 727 558.5 618.5Q666 510 666 357Q666 206 557.0 96.5Q448 -13 296 -13Q325 26 342.0 53.5Q359 81 384.5 131.0Q410 181 423.0 239.0Q436 297 436 360Q436 436 410.0 515.0Q384 594 361.0 634.0Q338 674 302 727Z', bbox=(296, -13, 666, 727)),
    'Mercury': dict(d='M218 108Q137 116 84.5 177.0Q32 238 32 322Q32 389 70.0 443.0Q108 497 168 522Q69 559 67 664H96Q106 617 150.5 592.0Q195 567 248.0 567.0Q301 567 345.5 592.0Q390 617 400 664H429Q427 559 328 521Q388 497 425.5 442.5Q463 388 463 322Q463 239 408.0 178.5Q353 118 278 108V-24H398V-64H278V-140Q278 -159 298 -167V-194H198V-167Q218 -161 218 -140V-64H97V-24H218ZM93 322Q93 248 138.5 197.5Q184 147 248 147Q318 147 360.5 198.0Q403 249 403 322Q403 396 360.5 446.5Q318 497 248 497Q177 497 135.0 447.0Q93 397 93 322Z', bbox=(32, -194, 463, 664)),
    'Venus': dict(d='M93 322Q93 248 138.5 197.5Q184 147 248 147Q318 147 360.5 198.0Q403 249 403 322Q403 396 360.5 446.5Q318 497 248 497Q177 497 135.0 447.0Q93 397 93 322ZM218 108Q137 116 84.5 177.0Q32 238 32 322Q32 411 96.0 474.0Q160 537 248.0 537.0Q336 537 399.5 473.5Q463 410 463 322Q463 239 408.0 178.5Q353 118 278 108V-24H398V-64H278V-140Q278 -159 298 -167V-194H198V-167Q218 -161 218 -140V-64H97V-24H218Z', bbox=(32, -194, 463, 537)),
    'Mars': dict(d='M32 205Q32 297 94.5 359.0Q157 421 248 421Q324 421 383 373L577 568L386 584V629H672V343H627L611 534L416 339Q463 280 463 205Q463 116 399.5 53.0Q336 -10 248 -10Q161 -10 96.5 52.5Q32 115 32 205ZM93 205Q93 132 136.5 81.0Q180 30 248 30Q318 30 360.5 81.0Q403 132 403 205Q403 279 361.5 329.5Q320 380 248 380Q177 380 135.0 330.0Q93 280 93 205Z', bbox=(32, -10, 672, 629)),
    'Jupiter': dict(d='M31 477Q36 500 41.0 517.0Q46 534 62.5 566.5Q79 599 99.5 620.5Q120 642 156.5 659.0Q193 676 239 676Q320 676 372.0 634.0Q424 592 424 519Q424 402 296 268L128 61H327V165H393V61H470V0H393V-105H327V0H30V12L208 217Q270 283 304.0 352.5Q338 422 338 481Q338 544 304.0 578.0Q270 612 207 612Q155 612 118.5 579.0Q82 546 52 472Z', bbox=(30, -105, 470, 676)),
    'Saturn': dict(d='M188 245V232H114V532H18Q18 532 18 571H114V680Q114 680 188 680V571H310V532H188V278Q223 323 257.0 342.5Q291 362 335 362Q395 362 426.5 326.0Q458 290 458 223V192Q458 128 407.0 69.0Q356 10 286.5 -25.0Q217 -60 151 -67V-52Q224 -37 299.0 46.0Q374 129 374 192V222Q374 272 356.5 290.0Q339 308 299 308Q270 308 244.5 293.5Q219 279 188 245Z', bbox=(18, -67, 458, 680)),
    'Uranus': dict(d='M337 415Q418 407 470.5 346.0Q523 285 523 201Q523 112 459.0 49.0Q395 -14 307.0 -14.0Q219 -14 155.5 49.5Q92 113 92 201Q92 284 147.0 344.5Q202 405 277 415V529H175Q173 505 164.5 485.0Q156 465 139.0 446.5Q122 428 91.0 416.5Q60 405 18 404V434Q69 444 92.5 471.0Q116 498 116.0 545.5Q116 593 92.5 620.0Q69 647 18 658V686Q95 685 131.5 651.5Q168 618 174 569H277V663Q277 682 257 690V717H357V690Q337 684 337 663V569H440Q446 618 482.5 651.5Q519 685 596 686V658Q545 647 521.5 620.0Q498 593 498.0 545.5Q498 498 521.5 471.0Q545 444 596 434V404Q554 405 523.0 416.5Q492 428 475.0 446.5Q458 465 449.5 485.0Q441 505 439 529H337ZM462 201Q462 275 416.5 325.5Q371 376 307 376Q237 376 194.5 325.0Q152 274 152 201Q152 127 194.5 76.5Q237 26 307 26Q378 26 420.0 76.0Q462 126 462 201Z', bbox=(18, -14, 596, 717)),
    'Neptune': dict(d='M255 542 234 564 336 662 440 564 418 541Q382 570 363 586V319Q433 329 478.0 377.0Q523 425 523 497V581Q491 554 475 542L454 564L556 662L660 564L638 541Q602 570 583 586V501Q583 400 521.5 335.5Q460 271 363 262V169H483V129H363V53Q363 34 383 26V-1H283V26Q303 32 303 53V129H182Q182 129 182 169H303V261Q205 270 143.0 334.5Q81 399 81 501V583Q46 554 30 542L10 564L112 662L214 564L193 541Q159 569 141 584V497Q141 430 188.0 379.5Q235 329 303 319V581Q271 554 255 542Z', bbox=(9, -1, 660, 663)),
    'Pluto': dict(d='M279 39Q321 39 353.0 46.0Q385 53 403.0 60.5Q421 68 435.5 84.5Q450 101 454.5 110.0Q459 119 466.5 139.0Q474 159 476 164H501L455 0H15V19Q67 24 83.0 39.5Q99 55 99 109V553Q99 606 81.5 622.5Q64 639 12 643V662H15H251Q296 662 335.5 653.5Q375 645 412.0 626.0Q449 607 471.0 570.0Q493 533 493 481Q493 453 489.5 431.0Q486 409 471.0 380.5Q456 352 430.0 333.0Q404 314 356.0 301.0Q308 288 242 288Q212 288 173 291V80Q173 54 190.0 46.5Q207 39 262 39ZM173 591V331Q207 328 230 328Q404 328 404 475Q404 552 356.0 588.5Q308 625 207 625Q187 625 180.0 618.0Q173 611 173 591Z', bbox=(12, 0, 501, 662)),
    'N.Node': dict(d='M27.0 157.0Q27.0 221.0 68.0 269.0Q109.0 317.0 172.0 327.0Q188.0 458.0 267.0 543.0Q346.0 628.0 467.0 628.0Q587.0 628.0 666.0 542.5Q745.0 457.0 762.0 327.0Q825.0 317.0 866.0 269.0Q907.0 221.0 907.0 157.0Q907.0 83.0 856.0 34.0Q805.0 -15.0 734.0 -15.0Q663.0 -15.0 612.5 34.0Q562.0 83.0 562.0 157.0Q562.0 226.0 609.5 275.5Q657.0 325.0 726.0 329.0Q711.0 442.0 641.0 517.5Q571.0 593.0 467.0 593.0Q362.0 593.0 292.5 518.0Q223.0 443.0 207.0 329.0Q277.0 325.0 324.0 275.5Q371.0 226.0 371.0 157.0Q371.0 83.0 320.5 34.0Q270.0 -15.0 199.0 -15.0Q125.0 -15.0 76.0 35.5Q27.0 86.0 27.0 157.0ZM76.0 157.0Q76.0 105.0 112.0 69.5Q148.0 34.0 199.0 34.0Q252.0 34.0 287.5 69.5Q323.0 105.0 323.0 157.0Q323.0 208.0 287.0 244.0Q251.0 280.0 199.0 280.0Q147.0 280.0 111.5 245.0Q76.0 210.0 76.0 157.0ZM611.0 157.0Q611.0 104.0 647.0 69.0Q683.0 34.0 734.0 34.0Q787.0 34.0 822.0 70.0Q857.0 106.0 857.0 157.0Q857.0 209.0 822.0 244.5Q787.0 280.0 734.0 280.0Q682.0 280.0 646.5 244.0Q611.0 208.0 611.0 157.0Z', bbox=(27, -15, 907, 628)),
}

ASPECT_PATHS = {
    'Conjunction': dict(d='M73 215Q73 173 88.0 140.0Q103 107 124.0 89.0Q145 71 171.5 59.0Q198 47 216.5 43.5Q235 40 248 40Q320 40 371.5 92.0Q423 144 423 215Q423 228 419.0 247.0Q415 266 402.5 291.5Q390 317 372.0 338.5Q354 360 321.5 375.0Q289 390 248 390Q175 390 124.0 338.5Q73 287 73 215ZM32 215Q32 266 50.5 306.5Q69 347 95.0 369.5Q121 392 153.0 406.5Q185 421 208.5 426.0Q232 431 248 431Q326 431 385 381L620 616Q626 622 634.0 622.0Q642 622 648.0 616.0Q654 610 654 602Q654 592 648 588L413 353Q463 292 463 215Q463 126 399.5 63.0Q336 0 248 0Q161 0 96.5 62.5Q32 125 32 215Z', bbox=(32, 0, 654, 622)),
    'Opposition': dict(d='M268 -68Q315 -68 351.5 -51.5Q388 -35 408.0 -11.5Q428 12 441.5 41.0Q455 70 459.0 91.0Q463 112 463 127Q463 208 405.5 265.0Q348 322 268 322Q187 322 130.0 264.5Q73 207 73 127Q73 46 130.5 -11.0Q188 -68 268 -68ZM268 -108Q212 -108 167.5 -88.0Q123 -68 98.5 -39.5Q74 -11 58.0 24.0Q42 59 37.0 84.0Q32 109 32 127Q32 225 101.5 293.5Q171 362 268 362Q348 362 414 312L500 490Q441 557 441 646Q441 741 509.5 811.0Q578 881 676 881Q732 881 776.0 861.0Q820 841 845.0 812.5Q870 784 886.0 749.0Q902 714 907.0 689.0Q912 664 912 646Q912 550 843.5 480.0Q775 410 676 410Q594 410 531 461L444 283Q503 216 503 127Q503 33 435.5 -37.5Q368 -108 268 -108ZM676 841Q596 841 538.5 783.0Q481 725 481 646Q481 565 539.0 508.0Q597 451 676 451Q757 451 814.5 508.5Q872 566 872.0 646.0Q872 726 813.5 783.5Q755 841 676 841Z', bbox=(32, -108, 912, 881)),
    'Sextile': dict(d='M792 243H471L632 -35L579 -66L418 212L257 -66L205 -35L365 243H44V304H365L205 583L257 613L418 334L579 613L632 583L471 304H792Z', bbox=(44, -66, 792, 613)),
    'Square': dict(d='M726 0H35V691H726ZM694 32V659H67V32Z', bbox=(35, 0, 726, 691)),
    'Trine': dict(d='M737 40 421 579 103 40ZM814 0H26L421 676Z', bbox=(26, 0, 814, 676)),
}

def glyph_svg_path(path_data, bbox, target_size, color):
    """Scale a font glyph path to fit target_size square, centered, as SVG <g>.
    Flips Y axis because font glyphs use Y-up but SVG uses Y-down."""
    xMin, yMin, xMax, yMax = bbox
    w, h = xMax - xMin, yMax - yMin
    scale = target_size / max(w, h) if max(w, h) > 0 else 1
    tx = (target_size - w * scale) / 2 - xMin * scale
    ty = (target_size - h * scale) / 2 + scale * yMax
    return (f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.6f},-{scale:.6f})">'
            f'<path d="{path_data}" fill="{color}" stroke="none"/></g>')

def sign_glyph_svg(sign, color, size=80, outline_color=None, outline_grow=1.06, interior_color="#ffffff"):
    """Render a sign glyph with a light interior fill and a stronger outline.
    Interior defaults to white but can be set to a light element tint; outline is
    the full element color at 6% larger so it prints clearly."""
    info = SIGN_PATHS.get(sign)
    if not info:
        return ""
    main = glyph_svg_path(info["d"], info["bbox"], size, interior_color)
    if outline_color:
        outline = glyph_svg_path(info["d"], info["bbox"], size * outline_grow, outline_color)
        return f'<g>{outline}{main}</g>'
    return main

PLANET_COLORS = {
    "Sun": "#ffd700",      # gold (galvanic Au)
    "Moon": "#c0c0c0",     # silver (galvanic Ag)
    "Mercury": "#87ceeb",  # sky blue
    "Venus": "#ff69b4",    # pink
    "Mars": "#ff4444",     # rust red (galvanic Fe)
    "Jupiter": "#ffa500",  # orange
    "Saturn": "#8b4513",   # saddle brown (galvanic Pb)
    "Uranus": "#34d399",   # emerald
    "Neptune": "#38bdf8",  # sky
    "Pluto": "#fb7185",    # rose
    "N.Node": "#a78bfa",   # violet
}

def planet_glyph_svg(planet, color=None, size=56, outline_color=None, outline_grow=1.06):
    """Render a planet glyph. If no color given, uses galvanic-aligned planet color."""
    if color is None:
        color = PLANET_COLORS.get(planet, "#222")
    """Render a planet glyph, optionally with a slightly larger outline for boldness."""
    info = PLANET_PATHS.get(planet)
    if not info:
        return ""
    main = glyph_svg_path(info["d"], info["bbox"], size, color)
    if outline_color:
        outline = glyph_svg_path(info["d"], info["bbox"], size * outline_grow, outline_color)
        return f'<g>{outline}{main}</g>'
    return main

def aspect_glyph_svg(aspect, color, size=16):
    info = ASPECT_PATHS.get(aspect)
    return glyph_svg_path(info["d"], info["bbox"], size, color) if info else ""

SAECULUM_BOUNDARIES = [
    (2429849.56, {"name":"Boomer","archetype":"Prophet","conj_year":1940,"conj_sign":"Taurus","conj_element":"Earth","turning":"Crisis"}),
    (2437349.50, {"name":"Gen X","archetype":"Nomad","conj_year":1961,"conj_sign":"Capricorn","conj_element":"Earth","turning":"High"}),
    (2444605.39, {"name":"Millennial","archetype":"Hero","conj_year":1981,"conj_sign":"Libra","conj_element":"Air","turning":"Awakening"}),
    (2451693.17, {"name":"Gen Z","archetype":"Artist","conj_year":2000,"conj_sign":"Taurus","conj_element":"Earth","turning":"Unraveling"}),
    (2459205.26, {"name":"Gen Alpha","archetype":"Prophet_GenAlpha","conj_year":2020,"conj_sign":"Aquarius","conj_element":"Air","turning":"Crisis"}),
]

ES_SIGNS = {"Aries":"Aries","Taurus":"Tauro","Gemini":"Géminis","Cancer":"Cáncer","Leo":"Leo","Virgo":"Virgo","Libra":"Libra","Scorpio":"Escorpio","Sagittarius":"Sagitario","Capricorn":"Capricornio","Aquarius":"Acuario","Pisces":"Piscis"}
ES_ELEMENTS = {"Fire":"Fuego","Earth":"Tierra","Air":"Aire","Water":"Agua"}
ES_QUALITIES = {"Cardinal":"Cardinal","Fixed":"Fijo","Mutable":"Mutable"}
ES_GEN_NAMES = {"Boomer":"Boomer","Gen X":"Gen X","Millennial":"Millennial","Gen Z":"Gen Z","Gen Alpha":"Gen Alpha","Unknown":"Desconocida"}
ES_ARCH_NAMES = {"Prophet":"Profeta","Nomad":"Nómada","Hero":"Héroe","Artist":"Artista","Prophet_GenAlpha":"Profeta","Unknown":"Desconocido"}
ES_TURNING_NAMES = {"High":"Alto","Awakening":"Despertar","Unraveling":"Desenredo","Crisis":"Crisis","Unknown":"Desconocido"}

OUTPUT_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "Company_OS", "deliverables", "cosmic-history-report"))


def sign_from_lon(lon):
    return SIGNS[int(lon % 360) // 30]

def degree_in_sign(lon):
    return (lon % 360) % 30

def house_from_lon(lon, cusps):
    """Return the 1-based Placidus house number for a longitude."""
    for i in range(12):
        start = cusps[i]
        end = cusps[(i + 1) % 12]
        # Handle wrap-around across 0°
        if start <= end:
            if start <= lon < end:
                return i + 1
        else:
            if lon >= start or lon < end:
                return i + 1
    return 1

def get_saeculum(jd):
    current = {"name":"Unknown","archetype":"","conj_year":0,"conj_sign":"","conj_element":"","turning":""}
    for jd_boundary, data in SAECULUM_BOUNDARIES:
        if jd < jd_boundary:
            return current
        current = data
    return current

def get_planet_data(jd):
    results = []
    for name, body_id in SWE_BODIES.items():
        result, ret = swe.calc_ut(jd, body_id, swe.FLG_SWIEPH)
        ld = result[0] % 360
        si = int(ld // 30)
        d, m = int(ld % 30), int((ld % 30 - int(ld % 30)) * 60)
        sign = SIGNS[si]
        results.append({
            "name": name,
            "lon_num": ld, "sign": sign,
            "deg": d, "min": m,
            "element": ELEMENTS[sign],
            "quality": QUALITIES[sign],
        })
    return results

def get_aspects(planets):
    aspects = []
    aspect_planets = [p for p in planets if p["name"] != "N.Node"]
    aspect_targets = {"Conjunction":0,"Sextile":60,"Square":90,"Trine":120,"Opposition":180}
    for i, p1 in enumerate(aspect_planets):
        for j, p2 in enumerate(aspect_planets):
            if j <= i: continue
            d = abs(p1["lon_num"] - p2["lon_num"])
            if d > 180: d = 360 - d
            for name, target in aspect_targets.items():
                orb = abs(d - target)
                if orb <= 6:
                    glyph = name  # ASPECT_PATHS key
                    aspects.append((p1,p2,d,name,orb,target,glyph))
    aspects.sort(key=lambda x: x[4])
    return aspects


def build_snapshot_html(birth_date, birth_time, birth_location, lat, lon,
                        year, month, day, hour, minute, tz_offset, tz_label,
                        recipient_name="", lang="en"):
    """Build the snapshot page HTML."""

    utc_hour_frac = (hour + tz_offset) + minute / 60.0
    jd = swe.julday(year, month, day, utc_hour_frac)
    planets = get_planet_data(jd)
    cusps, ascmc = swe.houses(jd, lat, lon, b'W')
    asc = ascmc[0]
    mc = ascmc[1]
    saec = get_saeculum(jd)
    aspects = get_aspects(planets)

    sun_sign = sign_from_lon(next(p["lon_num"] for p in planets if p["name"] == "Sun"))
    moon_sign = sign_from_lon(next(p["lon_num"] for p in planets if p["name"] == "Moon"))
    asc_sign = sign_from_lon(asc)

    sun_lon = next(p["lon_num"] for p in planets if p["name"] == "Sun")
    moon_lon = next(p["lon_num"] for p in planets if p["name"] == "Moon")
    chart_ruler, master, predominator, is_day = calculate_hellenistic_rulers(planets, asc, sun_lon, moon_lon)

    yuga_label = ("Closing Iron Age pressure field, later crossing into ascending Dvapara/Bronze Age after 2020"
                  if year < 2020 else "First ascending Bronze generation")
    era_label = ("Earth Era closing; Air Era beginning to seed itself"
                 if year < 2000 else "Air Era established")

    # House numbers for the Big 3 (which houses Sun, Moon, AC fall in)
    sun_house = house_from_lon(sun_lon, cusps)
    moon_house = house_from_lon(moon_lon, cusps)
    asc_house = 1

    # Glyphs and colors — SVG path-based (no font matching needed)
    sun_color = ELEMENT_COLORS.get(ELEMENTS.get(sun_sign, ''), '#333')
    moon_color = ELEMENT_COLORS.get(ELEMENTS.get(moon_sign, ''), '#333')
    asc_color = ELEMENT_COLORS.get(ELEMENTS.get(asc_sign, ''), '#333')
    sun_pastel = PASTEL.get(sun_color, '#f8f8f8')
    moon_pastel = PASTEL.get(moon_color, '#f8f8f8')
    asc_pastel = PASTEL.get(asc_color, '#f8f8f8')
    sun_light = LIGHT_ELEMENT.get(sun_color, '#e8e8e8')
    moon_light = LIGHT_ELEMENT.get(moon_color, '#e8e8e8')
    asc_light = LIGHT_ELEMENT.get(asc_color, '#e8e8e8')
    sun_glyph_svg = planet_glyph_svg("Sun", PLANET_COLORS["Sun"], 48)
    moon_glyph_svg = planet_glyph_svg("Moon", PLANET_COLORS["Moon"], 48)
    sun_sign_svg = sign_glyph_svg(sun_sign, sun_light, 80, outline_color=sun_color, interior_color=sun_light)
    moon_sign_svg = sign_glyph_svg(moon_sign, moon_light, 80, outline_color=moon_color, interior_color=moon_light)
    asc_sign_svg = sign_glyph_svg(asc_sign, asc_light, 80, outline_color=asc_color, interior_color=asc_light)

    # Degree positions
    sun_deg = int(degree_in_sign(sun_lon))
    sun_min = int((degree_in_sign(sun_lon) % 1) * 60)
    moon_deg = int(degree_in_sign(moon_lon))
    moon_min = int((degree_in_sign(moon_lon) % 1) * 60)
    asc_deg = int(degree_in_sign(asc))
    asc_min = int((degree_in_sign(asc) % 1) * 60)

    # Key aspects — build boxes matching chart page planet box style
    # Chart page: rect rx=3, pastel fill, element-colored stroke 1.5px
    # Here: same rect style but color-graded by aspect type (red/blue)
    aspect_top = []
    aspect_bottom = []
    for idx, (p1, p2, d, name, orb, target, glyph) in enumerate(aspects[:5]):
        target_row = aspect_top if idx < 3 else aspect_bottom
        if name in ("Conjunction", "Square", "Opposition"):
            border_c = "#d44a4a"
            bg_c = "#fde8e8"
        else:
            border_c = "#5a7ac0"
            bg_c = "#e8edf5"

        # Build SVG path glyphs for the aspect box — use planet's own color, not aspect color
        p1_svg = planet_glyph_svg(p1["name"], PLANET_COLORS.get(p1["name"], border_c), 18)
        asp_svg = aspect_glyph_svg(name, border_c, 14)
        p2_svg = planet_glyph_svg(p2["name"], PLANET_COLORS.get(p2["name"], border_c), 18)

        target_row.append(f"""
        <div class="asp-box" style="border:1.5px solid {border_c};background:transparent;">
            <svg class="asp-svg" width="100" height="22" viewBox="0 0 100 22">
                <g transform="translate(14,2)">{p1_svg}</g>
                <g transform="translate(43,4)">{asp_svg}</g>
                <g transform="translate(68,2)">{p2_svg}</g>
            </svg>
            <div class="asp-name">{name}</div>
            <div class="asp-orb">{orb:.1f}&deg;</div>
        </div>""")

    aspect_top = "".join(aspect_top)
    aspect_bottom = "".join(aspect_bottom)

    is_es = (lang == "es")

    if is_es:
        title = "Instantánea Cósmica"
        gen_text = f"{ES_GEN_NAMES.get(saec['name'],saec['name'])} / {ES_ARCH_NAMES.get(saec['archetype'],saec['archetype'])}"
        turning_text = ES_TURNING_NAMES.get(saec['turning'], saec['turning'])
        anchor_text = f"{saec['conj_year']} {ES_SIGNS.get(saec['conj_sign'],saec['conj_sign'])} {ES_ELEMENTS.get(saec['conj_element'],saec['conj_element'])}"
        sun_label = f"Sol en {ES_SIGNS.get(sun_sign, sun_sign)}"
        moon_label = f"Luna en {ES_SIGNS.get(moon_sign, moon_sign)}"
        asc_label = f"{ES_SIGNS.get(asc_sign, asc_sign)} Ascendente"
        sun_elem = f"{ES_ELEMENTS.get(ELEMENTS.get(sun_sign,''), ELEMENTS.get(sun_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(sun_sign,''), QUALITIES.get(sun_sign,''))}"
        moon_elem = f"{ES_ELEMENTS.get(ELEMENTS.get(moon_sign,''), ELEMENTS.get(moon_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(moon_sign,''), QUALITIES.get(moon_sign,''))}"
        asc_elem = f"{ES_ELEMENTS.get(ELEMENTS.get(asc_sign,''), ELEMENTS.get(asc_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(asc_sign,''), QUALITIES.get(asc_sign,''))}"
        gen_label = "Generación"
        turning_label = "Giro de Nacimiento"
        anchor_label = "Ancla Saturno-Júpiter"
        yuga_label_es = ("Campo de presión de la Edad de Hierro, cruzando al Dvapara ascendente/Edad de Bronce después de 2020"
                         if year < 2020 else "Primera generación de Bronce ascendente")
        yuga_label_display = yuga_label_es
        era_label_es = ("Era de Tierra cerrando; Era de Aire comenzando a sembrarse"
                        if year < 2000 else "Era de Aire establecida")
        era_label_display = era_label_es
        era_label_short = "Era Elemental"
        yuga_label_short = "Posición de Yuga"
        ruler_label = "Señor de la Carta"
        aspects_label = "Aspectos Clave"
        sect_label = "Secta"
        sect_val = "Día" if is_day else "Noche"
        deg_fmt = f"{sun_deg}°{sun_min:02d}'"
        moon_deg_fmt = f"{moon_deg}°{moon_min:02d}'"
        asc_deg_fmt = f"{asc_deg}°{asc_min:02d}'"
    else:
        title = "Cosmic Snapshot"
        gen_text = f"{saec['name']} / {saec['archetype']}"
        turning_text = saec['turning']
        anchor_text = f"{saec['conj_year']} {saec['conj_sign']} {saec['conj_element']}"
        sun_label = f"Sun in {sun_sign}"
        moon_label = f"Moon in {moon_sign}"
        asc_label = f"{asc_sign} Rising"
        sun_elem = f"{ELEMENTS.get(sun_sign,'')} · {QUALITIES.get(sun_sign,'')}"
        moon_elem = f"{ELEMENTS.get(moon_sign,'')} · {QUALITIES.get(moon_sign,'')}"
        asc_elem = f"{ELEMENTS.get(asc_sign,'')} · {QUALITIES.get(asc_sign,'')}"
        gen_label = "Generation"
        turning_label = "Birth Turning"
        anchor_label = "Saturn-Jupiter Anchor"
        yuga_label_display = yuga_label
        era_label_display = era_label
        era_label_short = "Elemental Era"
        yuga_label_short = "Yuga Position"
        ruler_label = "Chart Ruler"
        aspects_label = "Key Aspects"
        sect_label = "Sect"
        sect_val = "Day" if is_day else "Night"
        deg_fmt = f"{sun_deg}°{sun_min:02d}'"
        moon_deg_fmt = f"{moon_deg}°{moon_min:02d}'"
        asc_deg_fmt = f"{asc_deg}°{asc_min:02d}'"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
@font-face {{ font-family: 'AstroGlyphs'; src: url('file:///usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') format('truetype'); }}
@page {{ size: letter; margin: 0.5in; }}
body {{ background:#ffffff; margin:0; padding:0; font-family:Georgia,"DejaVu Serif",serif; color:#222; }}
.astroglyph {{ font-family:"FreeSerif","DejaVu Sans","Noto Sans Symbols",sans-serif; }}
.snapshot {{
    border:3px solid #1a3a5c;
    border-radius:14px;
    overflow:hidden;
    background:#ffffff;
    min-height:9.5in;
}}
.snap-header {{
    background:#1a3a5c;
    color:white;
    text-align:center;
    padding:18px 20px 14px;
}}
.snap-header .title {{
    font-size:18pt;
    font-weight:bold;
    letter-spacing:4px;
    text-transform:uppercase;
}}
.snap-header .subtitle {{
    font-size:9pt;
    color:rgba(255,255,255,0.7);
    margin-top:6px;
}}
.snap-body {{
    padding:24px 28px;
}}
/* ── Big 3 triad — house-shaped containers, colored by element ── */
.triad {{
    display:table;
    width:100%;
    margin:0 0 10px;
}}
.triad-col {{
    display:table-cell;
    width:33.33%;
    text-align:center;
    padding:18px 6px 10px;
    vertical-align:top;
}}
/* House shape: pentagon drawn with inline SVG. Sign glyph and planet glyph
   are SVG <text> elements inside the SVG. WeasyPrint ignores fill-opacity and
   opacity on SVG text, so we use pre-lightened fill colors for the watermark. */
.house-wrap {{
    width:120px;
    height:130px;
    margin:0 auto;
    position:relative;
}}
.triad-col .label {{
    font-size:11pt;
    font-weight:bold;
    color:#1a3a5c;
    margin-top:10px;
}}
.triad-col .sublabel {{
    font-size:8pt;
    color:#333;
    margin-top:2px;
}}
.triad-col .degree {{
    font-size:8pt;
    color:#555;
    margin-top:2px;
}}
/* ── Divider ── */
.divider {{
    border:none;
    border-top:1.5px solid rgba(26,58,92,0.12);
    margin:16px 0;
}}
/* ── Info grid ── */
.info-grid {{
    display:table;
    width:100%;
    font-size:10pt;
}}
.info-row {{
    display:table-row;
}}
.info-cell {{
    display:table-cell;
    padding:7px 12px;
    border-bottom:1px solid rgba(26,58,92,0.06);
}}
.info-cell.label {{
    width:35%;
    color:#1a3a5c;
    font-weight:bold;
    white-space:nowrap;
}}
.info-cell.value {{
    width:65%;
    color:#333;
}}
/* ── Key Aspects — boxes matching chart page planet box style ── */
.aspects-section {{
    margin-top:8px;
}}
.aspects-heading {{
    font-size:9pt;
    font-weight:bold;
    color:#1a3a5c;
    text-transform:uppercase;
    letter-spacing:2px;
    text-align:center;
    margin-bottom:14px;
}}
.aspects-row {{
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:10px;
    margin-bottom:10px;
}}
.asp-box {{
    border-radius:4px;
    text-align:center;
    padding:8px 14px;
    width:140px;
    box-sizing:border-box;
}}
.asp-box .asp-glyph {{
    font-size:16px;
    font-weight:bold;
    line-height:1.2;
}}
.asp-box .asp-name {{
    font-size:8.5pt;
    color:#333;
    margin-top:2px;
}}
.asp-box .asp-orb {{
    font-size:8pt;
    color:#777;
    margin-top:1px;
}}
/* ── Footer ── */
.snap-footer {{
    text-align:center;
    padding:12px 0 16px;
    border-top:1.5px solid rgba(26,58,92,0.12);
    margin:0 28px;
}}
.snap-footer .brand {{
    font-size:8.5pt;
    color:#1a3a5c;
    font-weight:bold;
    letter-spacing:1px;
}}
.snap-footer .url {{
    font-size:7.5pt;
    color:#888;
    margin-top:2px;
}}
</style>
</head>
<body>
<div class="snapshot">

<div class="snap-header">
<div class="title">{title}</div>
<div class="subtitle">{recipient_name} &middot; {birth_date} &middot; {birth_time} &middot; {birth_location}</div>
</div>

<div class="snap-body">

<!-- Big 3 triad — house shapes colored by element -->
<div class="triad">
<div class="triad-col">
<div class="house-wrap">
<svg width="120" height="130" viewBox="0 0 120 130">
<polygon points="60,8 112,42 112,122 8,122 8,42" fill="none" stroke="{sun_color}" stroke-width="2.5" stroke-linejoin="round"/>
<g transform="translate(20,25)">{sun_sign_svg}</g>
<g transform="translate(54,50)">{sun_glyph_svg}</g>
<text x="12" y="117" font-size="28" font-family="DejaVu Sans, sans-serif" fill="#666">H{sun_house}</text>
</svg>
</div>
<div class="label">{sun_label}</div>
<div class="sublabel">{sun_elem}</div>
<div class="degree">{deg_fmt}</div>
</div>
<div class="triad-col">
<div class="house-wrap">
<svg width="120" height="130" viewBox="0 0 120 130">
<polygon points="60,8 112,42 112,122 8,122 8,42" fill="none" stroke="{moon_color}" stroke-width="2.5" stroke-linejoin="round"/>
<g transform="translate(20,25)">{moon_sign_svg}</g>
<g transform="translate(64,50)">{moon_glyph_svg}</g>
<text x="12" y="117" font-size="28" font-family="DejaVu Sans, sans-serif" fill="#666">H{moon_house}</text>
</svg>
</div>
<div class="label">{moon_label}</div>
<div class="sublabel">{moon_elem}</div>
<div class="degree">{moon_deg_fmt}</div>
</div>
<div class="triad-col">
<div class="house-wrap">
<svg width="120" height="130" viewBox="0 0 120 130">
<polygon points="60,8 112,42 112,122 8,122 8,42" fill="none" stroke="{asc_color}" stroke-width="2.5" stroke-linejoin="round"/>
<g transform="translate(20,25)">{asc_sign_svg}</g>
<text x="12" y="117" font-size="28" font-family="DejaVu Sans, sans-serif" fill="#666">H{asc_house}</text>
<text x="80" y="75" font-size="37" font-weight="bold" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222" stroke="white" stroke-width="1.2" paint-order="stroke">AC</text>
</svg>
</div>
<div class="label">{asc_label}</div>
<div class="sublabel">{asc_elem}</div>
<div class="degree">{asc_deg_fmt}</div>
</div>
</div>

<hr class="divider">

<!-- Info grid -->
<div class="info-grid">
<div class="info-row">
<div class="info-cell label">{gen_label}</div>
<div class="info-cell value">{gen_text}</div>
</div>
<div class="info-row">
<div class="info-cell label">{turning_label}</div>
<div class="info-cell value">{turning_text}</div>
</div>
<div class="info-row">
<div class="info-cell label">{anchor_label}</div>
<div class="info-cell value">{anchor_text}</div>
</div>
<div class="info-row">
<div class="info-cell label">{era_label_short}</div>
<div class="info-cell value">{era_label_display}</div>
</div>
<div class="info-row">
<div class="info-cell label">{yuga_label_short}</div>
<div class="info-cell value">{yuga_label_display}</div>
</div>
<div class="info-row">
<div class="info-cell label">{ruler_label}</div>
<div class="info-cell value">{chart_ruler}</div>
</div>
<div class="info-row">
<div class="info-cell label">{sect_label}</div>
<div class="info-cell value">{sect_val}</div>
</div>
</div>

<hr class="divider">

<!-- Key Aspects — boxes matching chart page planet box style -->
<div class="aspects-section">
<div class="aspects-heading">{aspects_label}</div>
<div class="aspects-row">
{aspect_top}
</div>
<div class="aspects-row">
{aspect_bottom}
</div>
</div>

</div>

<div class="snap-footer">
<div class="brand">Zodiyuga SkyClock</div>
<div class="url">zodiyuga.com &middot; Swiss Ephemeris (DE440)</div>
</div>

</div>
</body>
</html>"""
    return html


def main():
    parser = argparse.ArgumentParser(description="Generate standalone Cosmic Snapshot page")
    parser.add_argument("--year", type=int, default=1982)
    parser.add_argument("--month", type=int, default=5)
    parser.add_argument("--day", type=int, default=2)
    parser.add_argument("--hour", type=int, default=2)
    parser.add_argument("--min", type=int, default=16)
    parser.add_argument("--lat", type=float, default=30.22)
    parser.add_argument("--lon", type=float, default=-81.68)
    parser.add_argument("--location", default="NAS Jacksonville, Florida")
    parser.add_argument("--name", default="")
    parser.add_argument("--output", default="snapshot_page.pdf")
    parser.add_argument("--tz", default="EDT", choices=["EST","EDT","CST","CDT","MST","MDT","PST","PDT","HST","AKST","COT"])
    parser.add_argument("--lang", default="en", choices=["en","es"])
    args = parser.parse_args()

    tz_offsets = {"EST":5,"EDT":4,"CST":6,"CDT":5,"MST":7,"MDT":6,"PST":8,"PDT":7,"AKST":9,"HST":10,"COT":5}
    tz_offset = tz_offsets[args.tz]

    months_en = ['January','February','March','April','May','June','July','August','September','October','November','December']
    months_es = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    months = months_es if args.lang == "es" else months_en
    birth_date = f"{months[args.month-1]} {args.day}, {args.year}"
    birth_time = f"{args.hour}:{args.min:02d} {args.tz}"

    print(f"Generating snapshot for {birth_date} at {birth_time}, {args.location}")

    html = build_snapshot_html(birth_date, birth_time, args.location, args.lat, args.lon,
                               args.year, args.month, args.day, args.hour, args.min, tz_offset,
                               args.tz, recipient_name=args.name, lang=args.lang)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    outpath = os.path.join(OUTPUT_DIR, args.output)
    HTML(string=html).write_pdf(outpath)
    print(f"PDF: {outpath} ({os.path.getsize(outpath)//1024} KB)")

if __name__ == "__main__":
    main()