import "./style.css";

declare function gtag(...args: unknown[]): void;

const CONSENT_KEY = "carma_analytics_consent";
const cookieBanner = document.querySelector<HTMLDivElement>("#cookie-banner");
const cookieAccept = document.querySelector<HTMLButtonElement>("#cookie-accept");
const cookieDecline = document.querySelector<HTMLButtonElement>("#cookie-decline");

function readConsentChoice(): string | null {
    try {
        return localStorage.getItem(CONSENT_KEY);
    } catch {
        return null;
    }
}

function writeConsentChoice(value: "granted" | "denied") {
    try {
        localStorage.setItem(CONSENT_KEY, value);
    } catch {
        // storage unavailable; the choice just won't persist across visits
    }
}

if (cookieBanner && cookieAccept && cookieDecline) {
    const existingChoice = readConsentChoice();
    if (existingChoice === "granted") {
        gtag("consent", "update", { analytics_storage: "granted" });
    } else if (existingChoice === null) {
        cookieBanner.classList.remove("hidden");
    }

    cookieAccept.addEventListener("click", () => {
        gtag("consent", "update", { analytics_storage: "granted" });
        writeConsentChoice("granted");
        cookieBanner.classList.add("hidden");
    });

    cookieDecline.addEventListener("click", () => {
        writeConsentChoice("denied");
        cookieBanner.classList.add("hidden");
    });
}

const demoVideoFrame = document.querySelector<HTMLDivElement>("#demo-video-frame");
const demoVideoPlay = document.querySelector<HTMLButtonElement>("#demo-video-play");

if (demoVideoFrame && demoVideoPlay) {
    demoVideoPlay.addEventListener("click", () => {
        const video = document.createElement("video");
        video.src = "/video/carma-demo.mp4";
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        demoVideoFrame.replaceChildren(video);
    });
}

const LEADS_SHEETS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbzc3Xvs-XsNStvFIbfu_ffNvpiQAzFwdVlDWeeySGWt4mcwzYgGCMQk7EE-vEENQ_Bc/exec";
const LEAD_SUCCESS_SESSION_KEY = "carma_signup_completed";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const leadForm = document.querySelector<HTMLFormElement>("#lead-form")!;
const emailInput = document.querySelector<HTMLInputElement>("#email")!;
const emailWrap = document.querySelector<HTMLDivElement>("#email-wrap")!;
const consentInput = document.querySelector<HTMLInputElement>("#consent")!;
const formMsg = document.querySelector<HTMLParagraphElement>("#form-msg")!;
const leadSuccess = document.querySelector<HTMLDivElement>("#lead-success")!;
const shareCta = document.querySelector<HTMLButtonElement>("#share-cta")!;
const honeypot = document.querySelector<HTMLInputElement>("#website")!;

function showLeadSuccessState() {
    leadForm.classList.add("hidden");
    leadSuccess.classList.remove("hidden");
    leadSuccess.focus();
}

function readSuccessFlag(): boolean {
    try {
        return sessionStorage.getItem(LEAD_SUCCESS_SESSION_KEY) === "1";
    } catch {
        return false;
    }
}

function writeSuccessFlag() {
    try {
        sessionStorage.setItem(LEAD_SUCCESS_SESSION_KEY, "1");
    } catch {
        // storage unavailable; success state just won't persist across reloads
    }
}

if (readSuccessFlag()) {
    leadForm.classList.add("hidden");
    leadSuccess.classList.remove("hidden");
}

function setMessage(type: "success" | "error", text: string) {
    formMsg.className = `form-msg ${type}`;
    formMsg.textContent = text;
}

function setInputState(valid: boolean) {
    emailWrap.classList.remove("valid", "invalid");
    emailWrap.classList.add(valid ? "valid" : "invalid");
    if (valid) {
        emailInput.removeAttribute("aria-invalid");
    } else {
        emailInput.setAttribute("aria-invalid", "true");
    }
}

function clearErrorState() {
    if (emailWrap.classList.contains("invalid")) {
        emailWrap.classList.remove("invalid");
        emailInput.removeAttribute("aria-invalid");
    }
    formMsg.className = "form-msg hidden";
}

emailInput.addEventListener("input", clearErrorState);
consentInput.addEventListener("change", clearErrorState);

async function sendLeadToSheets(email: string) {
    const formData = new FormData();
    formData.append("email", email);

    const response = await fetch(LEADS_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
        redirect: "follow"
    });

    if (response.type !== "opaque" && !response.ok) {
        throw new Error("Sheets submit failed");
    }
}

leadForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (honeypot.value.trim() !== "") {
        return;
    }

    const value = emailInput.value.trim();

    if (!emailRegex.test(value)) {
        setInputState(false);
        setMessage("error", "נא להזין כתובת אימייל תקינה כדי להמשיך.");
        emailInput.focus();
        return;
    }

    if (!consentInput.checked) {
        setInputState(false);
        setMessage("error", "כדי להצטרף צריך לאשר את תנאי הפרטיות.");
        consentInput.focus();
        return;
    }

    setInputState(true);

    const submitButton = leadForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const originalText = submitButton.textContent;
    submitButton.textContent = "שולח...";
    submitButton.disabled = true;

    sendLeadToSheets(value)
        .then(() => {
            if (typeof gtag !== "undefined") {
                gtag("event", "sign_up", { method: "lead_form" });
            }
            leadForm.reset();
            writeSuccessFlag();
            showLeadSuccessState();
        })
        .catch(() => {
            setMessage("error", "לא הצלחנו לשמור את הפרטים כרגע. אפשר לנסות שוב בעוד רגע.");
        })
        .finally(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        });
});

shareCta.addEventListener("click", async () => {
    const shareText = "גיליתי את Carma - אפליקציה שמתגמלת נהיגה בטוחה. שווה להירשם לעדכונים.";
    const shareUrl = window.location.href;

    if (navigator.share) {
        try {
            await navigator.share({ text: shareText, url: shareUrl });
            return;
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            // real share failure; fall through to clipboard
        }
    }

    const fallbackText = `${shareText} ${shareUrl}`;
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(fallbackText);
            alert("הקישור הועתק. אפשר לשתף אותו בוואטסאפ או בכל ערוץ אחר.");
            return;
        } catch {
            // clipboard write failed; fall through to prompt
        }
    }

    prompt("העתיקו את הטקסט לשיתוף:", fallbackText);
});
