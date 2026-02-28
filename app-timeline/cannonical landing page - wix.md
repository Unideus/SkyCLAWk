**`/academy`** is the right canonical “Hour 2” doorway.

## What to do next (clean + simple)

### 1) Make the canonical landing page

Create a page in Wix called **Academy** and set its URL slug to:

**`https://zodiyuga.com/academy`**

In Wix, you change the page URL via **Pages & Menu → (page) → SEO basics → URL slug**. ([Wix Support][1])

### 2) Keep `/academy` public, put the *content* behind the membership

Use `/academy` as the marketing + preview page (what they get, 2–3 free clips, your philosophy, “Start here”).

Then make the actual library pages members-only, using Pricing Plans:

* `/academy/library`
* `/academy/lessons`
* `/academy/devlog` (optional)

Wix supports paywalling pages by connecting **Pricing Plans** to members-only pages. ([Wix Support][2])

### 3) Redirect any old paths to `/academy`

If you previously used `/hour2` or `/learn`, set 301 redirects so everything funnels to **/academy**. Wix has a URL Redirect Manager for 301s. ([Wix Support][3])

### 4) Use ONE link everywhere (repo + app + socials)

Update your GitHub sponsor button config to point to the Academy link:

`.github/FUNDING.yml`

```yml
github:
  - Unideus
custom:
  - https://zodiyuga.com/academy
```

GitHub’s Sponsor button is driven by `.github/FUNDING.yml` on the default branch. ([GitHub Docs][4])

### 5) Domain forwarding (your other domains)

Keep `zodiyuga.com` as primary, and redirect the two skyclock domains to it (as you planned). That keeps all “Hour 2” traffic landing at one canonical URL.

---

If you want, tell me the 3–5 core sections you want on the **/academy** page (example: “Start Here”, “How the Tool Works”, “Symbolism Framework”, “Dev Log”, “Join”), and I’ll draft the page structure and copy so you can paste it into Wix.

[1]: https://support.wix.com/en/article/wix-editor-changing-your-page-url?utm_source=chatgpt.com "Changing Your Page URL | Help Center"
[2]: https://support.wix.com/en/article/pricing-plans-making-site-pages-members-only?utm_source=chatgpt.com "Pricing Plans: Making Site Pages Members-Only"
[3]: https://support.wix.com/en/url-redirects-301-redirects-4987556?utm_source=chatgpt.com "URL Redirects (301 Redirects) | Help Center"
[4]: https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository?utm_source=chatgpt.com "Displaying a sponsor button in your repository"
