import type { APIRoute } from 'astro';

const NETLIFY_SITE_ID = import.meta.env.NETLIFY_SITE_ID;
const NETLIFY_API_TOKEN = import.meta.env.NETLIFY_API_TOKEN;

interface NetlifyDeploy {
	id: string;
	state: string;
	error_message?: string;
	created_at: string;
	published_at?: string;
	deploy_time?: number;
}

export const GET: APIRoute = async () => {
	if (!NETLIFY_SITE_ID || !NETLIFY_API_TOKEN) {
		return new Response(JSON.stringify({ error: 'Netlify API not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const response = await fetch(
			`https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys?per_page=1`,
			{
				headers: {
					Authorization: `Bearer ${NETLIFY_API_TOKEN}`,
				},
			}
		);

		if (!response.ok) {
			throw new Error(`Netlify API error: ${response.status}`);
		}

		const deploys: NetlifyDeploy[] = await response.json();
		const latest = deploys[0];

		if (!latest) {
			return new Response(JSON.stringify({ state: 'unknown' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(
			JSON.stringify({
				state: latest.state,
				error: latest.error_message,
				createdAt: latest.created_at,
				publishedAt: latest.published_at,
				deployTime: latest.deploy_time,
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Failed to fetch deploy status' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
};
