/** Markdown is bundled as text: a wrangler `rules` entry in production, a small Vite plugin in tests. */
declare module '*.md' {
  const text: string
  export default text
}
