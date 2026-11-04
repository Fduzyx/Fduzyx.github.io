import type { APIRoute } from 'astro';
import { withBase } from '../lib/paths';
export const GET: APIRoute = ({ site }) => new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL(withBase('sitemap.xml'), site)}\n`, { headers: { 'Content-Type': 'text/plain' } });
