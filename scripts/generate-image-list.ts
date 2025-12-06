import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';

const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

async function loadLocalImages(): Promise<string[]> {
	const imagesDir = join(process.cwd(), 'public', 'images');

	try {
		const files = await readdir(imagesDir);
		return files.filter(file => imageExtensions.test(file));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			console.log('Images directory not found. Creating empty list.');
			return [];
		}
		throw error;
	}
}

async function generateImageList(): Promise<void> {
	try {
		const imageList = await loadLocalImages();
		const outputPath = join(process.cwd(), 'public', 'images-list.json');

		await writeFile(outputPath, JSON.stringify(imageList, null, 2), 'utf-8');

		console.log(`Generated images-list.json with ${imageList.length} image(s)`);
	} catch (error) {
		console.error('Error generating image list:', error);
		process.exit(1);
	}
}

void generateImageList();

