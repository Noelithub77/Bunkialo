import "./style.css";

type LoginReply = { ok: boolean; message: string };

const form = document.querySelector<HTMLFormElement>("#login-form")!;
const identifier = document.querySelector<HTMLInputElement>("#identifier")!;
const password = document.querySelector<HTMLInputElement>("#password")!;
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const submit = document.querySelector<HTMLButtonElement>("#submit-button")!;
const back = document.querySelector<HTMLButtonElement>("#back-button")!;
const link = document.querySelector<HTMLAnchorElement>("#portal-link")!;
const toggle = document.querySelector<HTMLButtonElement>("#show-password")!;
const token = window.location.hash.slice(1);
window.history.replaceState(null, "", window.location.pathname);

let step: "lms" | "attendance" | "done" = "lms";

function setMessage(text: string, error = false): void {
  message.textContent = text;
  message.hidden = !text;
  message.classList.toggle("error", error);
}

function render(): void {
  const attendance = step === "attendance";
  document.querySelector("#step-pill")!.textContent = step === "done" ? "Connected" : `Step ${attendance ? 2 : 1} of 2`;
  document.querySelector("#step-hint")!.textContent = attendance ? "Now connect your attendance account." : "Connect your LMS account first.";
  document.querySelector("#account-label")!.textContent = attendance ? "Attendance portal" : "LMS";
  document.querySelector("#identifier-label")!.textContent = attendance ? "Institute email" : "Roll number";
  identifier.type = attendance ? "email" : "text";
  identifier.name = attendance ? "email" : "username";
  identifier.autocomplete = attendance ? "email" : "username";
  submit.textContent = attendance ? "Finish sign in" : "Continue";
  back.hidden = !attendance;
  link.hidden = !attendance;
  if (step === "done") {
    form.innerHTML = '<div class="heading"><span class="eyebrow">Connected</span><h2>Accounts saved</h2></div><p class="success">Your LMS and attendance credentials are stored in the OS keyring. You can close this tab and use the Bunkialo CLI.</p>';
    back.hidden = true;
    link.hidden = true;
  }
}

toggle.addEventListener("click", () => {
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  toggle.textContent = visible ? "Hide" : "Show";
  toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
});

back.addEventListener("click", () => {
  step = "lms";
  identifier.value = "";
  password.value = "";
  setMessage("");
  render();
  identifier.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!token || step === "done") {
    setMessage("Start this page with `bunkialo login` in your terminal.", true);
    return;
  }
  const account = identifier.value.trim();
  const secret = password.value;
  if (!account || !secret) return;
  submit.disabled = true;
  submit.textContent = "Connecting…";
  setMessage("");
  try {
    const response = await fetch(step === "lms" ? "/api/lms" : "/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bunkialo-Token": token },
      body: JSON.stringify(step === "lms" ? { username: account, password: secret } : { email: account, password: secret }),
      cache: "no-store",
    });
    const result = (await response.json()) as LoginReply;
    if (!response.ok || !result.ok) {
      setMessage(result.message || "Could not connect your account.", true);
      return;
    }
    password.value = "";
    identifier.value = "";
    step = step === "lms" ? "attendance" : "done";
    render();
    if (step !== "done") identifier.focus();
  } catch {
    setMessage("The local Bunkialo login window is unavailable. Run `bunkialo login` again.", true);
  } finally {
    if (step !== "done") {
      submit.disabled = false;
      submit.textContent = step === "attendance" ? "Finish sign in" : "Continue";
    }
  }
});

render();
