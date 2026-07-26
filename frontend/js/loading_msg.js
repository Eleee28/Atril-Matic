const loadingMessage = document.getElementById("loading-message");

export function showLoadingMessage(message) {
	loadingMessage.textContent = message;
	loadingMessage.hidden = false;
}

export function hideLoadingMessage(message) {
	loadingMessage.textContent = "";
	loadingMessage.hidden = true;
}