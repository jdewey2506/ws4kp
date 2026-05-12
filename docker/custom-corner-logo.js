const customCornerLogo = () => {
	document.querySelectorAll('.logo img').forEach((logo) => {
		logo.src = 'images/logos/custom-corner-logo.png';
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', customCornerLogo);
} else {
	customCornerLogo();
}
