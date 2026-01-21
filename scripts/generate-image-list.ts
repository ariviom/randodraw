import { writeFile, mkdir, rm } from 'fs/promises';
import { join, parse } from 'path';
import sharp from 'sharp';

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MAX_DIMENSION = 1920;

interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
}

interface DriveListResponse {
	files: DriveFile[];
	nextPageToken?: string;
}

async function listDriveFiles(): Promise<DriveFile[]> {
	if (!GOOGLE_DRIVE_FOLDER_ID || !GOOGLE_API_KEY) {
		console.log('Google Drive credentials not configured. Skipping image sync.');
		return [];
	}

	const files: DriveFile[] = [];
	let pageToken: string | undefined;

	do {
		const params = new URLSearchParams({
			q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and (mimeType contains 'image/')`,
			key: GOOGLE_API_KEY,
			fields: 'files(id,name,mimeType),nextPageToken',
			pageSize: '100',
		});

		if (pageToken) {
			params.set('pageToken', pageToken);
		}

		const response = await fetch(
			`https://www.googleapis.com/drive/v3/files?${params}`
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to list Drive files: ${response.status} ${error}`);
		}

		const data: DriveListResponse = await response.json();
		files.push(...data.files);
		pageToken = data.nextPageToken;
	} while (pageToken);

	return files;
}

async function downloadAndProcessFile(fileId: string, fileName: string, outputDir: string): Promise<string> {
	// Use direct download URL for publicly shared files
	const response = await fetch(
		`https://drive.google.com/uc?export=download&id=${fileId}`
	);

	if (!response.ok) {
		throw new Error(`Failed to download ${fileName}: ${response.status}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	const outputName = `${parse(fileName).name}.webp`;

	await sharp(buffer)
		.resize(MAX_DIMENSION, MAX_DIMENSION, {
			fit: 'inside',
			withoutEnlargement: true,
		})
		.webp({ quality: 80 })
		.toFile(join(outputDir, outputName));

	return outputName;
}

async function generateImageList() {
	const imagesDir = join(process.cwd(), 'public', 'images');
	const outputPath = join(process.cwd(), 'public', 'images-list.json');

	try {
		const driveFiles = await listDriveFiles();

		if (driveFiles.length === 0) {
			console.log('No images found in Google Drive folder.');
			await writeFile(outputPath, JSON.stringify([], null, 2), 'utf-8');
			return;
		}

		// Clear and recreate images directory
		await rm(imagesDir, { recursive: true, force: true });
		await mkdir(imagesDir, { recursive: true });

		console.log(`Processing ${driveFiles.length} image(s) from Google Drive...`);

		// Download and process all images
		const imageNames: string[] = [];
		for (const file of driveFiles) {
			console.log(`  Processing: ${file.name}`);
			const outputName = await downloadAndProcessFile(file.id, file.name, imagesDir);
			imageNames.push(outputName);
		}

		// Generate the image list
		await writeFile(outputPath, JSON.stringify(imageNames, null, 2), 'utf-8');

		console.log(`Generated images-list.json with ${imageNames.length} image(s) (resized to max ${MAX_DIMENSION}px, converted to WebP)`);
	} catch (error) {
		console.error('Error syncing images from Google Drive:', error);
		process.exit(1);
	}
}

generateImageList();
