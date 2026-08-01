// Scanned by scripts/generate-module-router.mjs (mirrors modules/shop/lib/robots.ts).
// Search-results URLs are infinite query permutations - crawlers stay out.
export async function getPublicRobotsDisallow(): Promise<string[]> {
  return ['/search']
}
