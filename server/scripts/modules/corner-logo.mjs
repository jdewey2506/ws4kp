const DEFAULT_LOGO_SRC = 'images/logos/logo-corner.png';
const LOGO_STORAGE_KEY = 'cornerLogo';

const logoElements = () => document.querySelectorAll('.logo img');

const applyLogo = (src = DEFAULT_LOGO_SRC) => {
	logoElements().forEach((logo) => {
		logo.src = src;
	});
};

const storedLogo = () => localStorage.getItem(LOGO_STORAGE_KEY);

const resetLogo = () => {
	localStorage.removeItem(LOGO_STORAGE_KEY);
	applyLogo();
};

const chooseLogo = (file) => {
	if (!file) return;
	if (!file.type.startsWith('image/')) return;

	const reader = new FileReader();
	reader.addEventListener('load', () => {
		try {
			localStorage.setItem(LOGO_STORAGE_KEY, reader.result);
			applyLogo(reader.result);
		} catch (error) {
			console.warn(`Unable to store custom corner logo: ${error}`);
			applyLogo(reader.result);
		}
	});
	reader.readAsDataURL(file);
};

const addSettingsControl = () => {
	const settingsSection = document.querySelector('#settings');
	if (!settingsSection) return;

	const label = document.createElement('label');
	label.id = 'settings-cornerLogo-label';
	label.classList.add('logo-setting');

	const text = document.createElement('span');
	text.innerHTML = 'Corner Logo ';

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.id = 'settings-cornerLogo-file';
	input.name = 'settings-cornerLogo-file';
	input.addEventListener('change', (event) => chooseLogo(event.target.files?.[0]));

	const resetButton = document.createElement('button');
	resetButton.type = 'button';
	resetButton.id = 'settings-cornerLogo-reset';
	resetButton.innerHTML = 'Reset';
	resetButton.addEventListener('click', () => {
		input.value = '';
		resetLogo();
	});

	label.append(text, input, resetButton);
	settingsSection.append(label);
};

document.addEventListener('DOMContentLoaded', () => {
	applyLogo(storedLogo() ?? DEFAULT_LOGO_SRC);
	addSettingsControl();
});
