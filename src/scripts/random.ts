type ImageList = string[];

const preloadImage = (source: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve();
		image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
		image.src = source;
	});

const buildImageSource = (source: string): string => `/images/${source}`;

export function initializeRandomImage(): void {
	let images: ImageList = [];
	let loadSequence = 0;

	const imageElement = document.getElementById('random-image') as HTMLImageElement | null;
	const buttonElement = document.getElementById('random-button');

	if (!imageElement) {
		console.warn('Random image element was not found in the DOM.');
		return;
	}

	const showStatus = (message: string) => {
		imageElement.alt = message;
		imageElement.style.display = 'none';
	};

	const revealImage = () => {
		imageElement.style.display = 'block';
	};

	const swapToImage = async (nextSource: string) => {
		const sequence = ++loadSequence;

		imageElement.style.opacity = '0';

		try {
			await preloadImage(nextSource);

			// Abort if another image request superseded this one.
			if (sequence !== loadSequence) {
				return;
			}

			imageElement.src = nextSource;
			revealImage();

			requestAnimationFrame(() => {
				imageElement.style.opacity = '1';
			});
		} catch (error) {
			console.error(error);
			imageElement.style.opacity = '1';
		}
	};

	const showRandomImage = () => {
		if (!images.length) return;

		const randomIndex = Math.floor(Math.random() * images.length);
		const nextSource = buildImageSource(images[randomIndex]);

		swapToImage(nextSource);
	};

	const loadImages = async () => {
		try {
			const response = await fetch('/images-list.json');
			images = (await response.json()) as ImageList;

			if (!images.length) {
				showStatus('No images found. Please add images to public/images/.');
				return;
			}

			showRandomImage();
		} catch (error) {
			console.error('Failed to load images:', error);
			showStatus('Failed to load images.');
		}
	};

	buttonElement?.addEventListener('click', () => {
		showRandomImage();
	});

	void loadImages();
}

const bootstrap = () => {
	if (typeof document === 'undefined') return;
	initializeRandomImage();
};

// Auto-run on load so the module works via script src.
bootstrap();

