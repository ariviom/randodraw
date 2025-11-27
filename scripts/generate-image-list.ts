import { readdir } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

async function fetchPinterestImages(pinterestUrl: string): Promise<string[]> {
	try {
		console.log(`Fetching images from Pinterest: ${pinterestUrl}`);
		
		// Handle boardId URL format - convert to RSS feed if possible
		let urlToFetch = pinterestUrl;
		const boardIdMatch = pinterestUrl.match(/boardId=(\d+)/);
		if (boardIdMatch) {
			const boardId = boardIdMatch[1];
			// Try Pinterest RSS feed format
			urlToFetch = `https://www.pinterest.com/board/${boardId}/feed.rss`;
			console.log(`Trying RSS feed format: ${urlToFetch}`);
		}
		
		const response = await fetch(urlToFetch, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
		});

		if (!response.ok) {
			// If RSS fails, try original URL
			if (urlToFetch !== pinterestUrl) {
				console.log(`RSS feed failed, trying original URL: ${pinterestUrl}`);
				const fallbackResponse = await fetch(pinterestUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
				});
				if (!fallbackResponse.ok) {
					throw new Error(`Failed to fetch Pinterest page: ${fallbackResponse.status}`);
				}
				const html = await fallbackResponse.text();
				return extractImagesFromHTML(html);
			}
			throw new Error(`Failed to fetch Pinterest page: ${response.status}`);
		}

		const content = await response.text();
		
		// Check if it's RSS/XML format
		if (content.includes('<?xml') || content.includes('<rss')) {
			return extractImagesFromRSS(content);
		}
		
		// Otherwise, extract from HTML
		return extractImagesFromHTML(content);
	} catch (error) {
		console.error('Error fetching Pinterest images:', error);
		throw error;
	}
}

function extractImagesFromRSS(rssContent: string): string[] {
	const imageUrls: string[] = [];
	const $ = cheerio.load(rssContent, { xmlMode: true });
	
	// Extract image URLs from RSS items
	$('item').each((_, element) => {
		const description = $(element).find('description').text();
		const enclosure = $(element).find('enclosure').attr('url');
		
		if (enclosure) {
			imageUrls.push(enclosure);
		}
		
		// Extract images from description HTML
		if (description) {
			const desc$ = cheerio.load(description);
			desc$('img').each((_, img) => {
				const src = desc$(img).attr('src');
				if (src && !imageUrls.includes(src)) {
					imageUrls.push(src);
				}
			});
		}
	});
	
	return imageUrls;
}

function extractImagesFromHTML(html: string): string[] {
	const $ = cheerio.load(html);
	const imageUrls: string[] = [];

		// Extract images from Pinterest's JSON-LD structured data
		$('script[type="application/ld+json"]').each((_, element) => {
			try {
				const jsonData = JSON.parse($(element).html() || '{}');
				if (jsonData.image) {
					if (Array.isArray(jsonData.image)) {
						jsonData.image.forEach((img: string | { url?: string }) => {
							const url = typeof img === 'string' ? img : img.url;
							if (url && !imageUrls.includes(url)) {
								imageUrls.push(url);
							}
						});
					} else if (typeof jsonData.image === 'string') {
						if (!imageUrls.includes(jsonData.image)) {
							imageUrls.push(jsonData.image);
						}
					} else if (jsonData.image.url) {
						if (!imageUrls.includes(jsonData.image.url)) {
							imageUrls.push(jsonData.image.url);
						}
					}
				}
			} catch (e) {
				// Skip invalid JSON
			}
		});

		// Extract images from img tags with Pinterest-specific attributes
		$('img').each((_, element) => {
			const src = $(element).attr('src') || $(element).attr('data-pin-media') || $(element).attr('data-lazy');
			if (src && (src.includes('pinimg.com') || src.includes('pinterest.com'))) {
				if (!imageUrls.includes(src)) {
					// Convert to higher quality if available
					let highQualitySrc = src;
					if (src.includes('pinimg.com')) {
						highQualitySrc = src.replace(/\/\d+x\//, '/originals/').replace(/\/\d+x\d+\//, '/originals/');
					}
					imageUrls.push(highQualitySrc);
				}
			}
		});

		// Extract from all script tags that might contain Pinterest data
		$('script').each((_, element) => {
			try {
				const content = $(element).html();
				if (!content) return;
				
				// Try to find Pinterest initial state
				const stateMatch = content.match(/__PINTEREST_INITIAL_STATE__\s*=\s*({.*?});/s);
				if (stateMatch) {
					const state = JSON.parse(stateMatch[1]);
					const extractImages = (obj: any, depth = 0): void => {
						if (depth > 10) return; // Prevent infinite recursion
						if (typeof obj === 'string' && (obj.includes('pinimg.com') || obj.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
							if (!imageUrls.includes(obj)) {
								imageUrls.push(obj);
							}
						} else if (Array.isArray(obj)) {
							obj.forEach(item => extractImages(item, depth + 1));
						} else if (obj && typeof obj === 'object') {
							Object.values(obj).forEach(value => extractImages(value, depth + 1));
						}
					};
					extractImages(state);
				}
				
				// Also look for image URLs in any JSON-like structures
				const urlMatches = content.match(/https?:\/\/[^"'\s]+pinimg\.com[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi);
				if (urlMatches) {
					urlMatches.forEach(url => {
						if (!imageUrls.includes(url)) {
							imageUrls.push(url);
						}
					});
				}
			} catch (e) {
				// Skip if parsing fails
			}
		});

	// Filter to only valid image URLs and remove duplicates
	const uniqueImages = Array.from(new Set(imageUrls.filter(url => 
		url && (url.includes('pinimg.com') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i))
	)));

	return uniqueImages;
}

async function generateImageList() {
	const pinterestUrl = process.env.PUBLIC_PINTEREST_URL;
	
	try {
		let imageList: string[] = [];

		if (pinterestUrl) {
			// Fetch from Pinterest
			imageList = await fetchPinterestImages(pinterestUrl);
			console.log(`Fetched ${imageList.length} image(s) from Pinterest`);
		} else {
			// Use local images
			try {
				const imagesDir = join(process.cwd(), 'public', 'images');
				const files = await readdir(imagesDir);
				imageList = files.filter((file) =>
					/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
				);
				console.log(`Found ${imageList.length} local image(s)`);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
					console.log('Images directory not found. Creating empty list.');
					imageList = [];
				} else {
					throw error;
				}
			}
		}
		
		const outputPath = join(process.cwd(), 'public', 'images-list.json');
		await writeFile(outputPath, JSON.stringify(imageList, null, 2), 'utf-8');
		
		console.log(`Generated images-list.json with ${imageList.length} image(s)`);
	} catch (error) {
		console.error('Error generating image list:', error);
		process.exit(1);
	}
}

generateImageList();

