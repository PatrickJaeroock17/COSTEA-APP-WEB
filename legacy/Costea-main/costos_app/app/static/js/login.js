"use strict";

const loginForm = document.querySelector(".login-form");
const loginPassword = document.getElementById("password");
const loginToggle = document.querySelector("[data-login-password-toggle]");

if (loginToggle && loginPassword) {
  loginToggle.hidden = false;
  loginToggle.addEventListener("click", () => {
    const visible = loginPassword.type === "password";
    loginPassword.type = visible ? "text" : "password";
    loginToggle.setAttribute("aria-pressed", String(visible));
    loginToggle.setAttribute("aria-label", `${visible ? "Ocultar" : "Mostrar"} contraseña`);
    loginToggle.querySelector("i").className = visible ? "bi bi-eye" : "bi bi-eye-slash";
  });
  const capsNotice = document.querySelector(".login-caps");
  const showCapsLock = (event) => {
    capsNotice.hidden = !event.getModifierState("CapsLock");
  };
  loginPassword.addEventListener("keydown", showCapsLock);
  loginPassword.addEventListener("keyup", showCapsLock);
  loginPassword.addEventListener("blur", () => { capsNotice.hidden = true; });
}

const recoveryLink = document.querySelector("[data-login-recovery]");
const recoveryDialog = document.querySelector(".login-recovery-dialog");
if (recoveryLink && recoveryDialog?.showModal) {
  recoveryLink.addEventListener("click", (event) => {
    event.preventDefault();
    recoveryDialog.showModal();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", () => {
    const submit = loginForm.querySelector("[type='submit']");
    submit.disabled = true;
    submit.querySelector("span").textContent = "Iniciando sesión…";
    loginForm.setAttribute("aria-busy", "true");
  });
  window.addEventListener("pageshow", () => {
    const submit = loginForm.querySelector("[type='submit']");
    submit.disabled = false;
    submit.querySelector("span").textContent = "Iniciar sesión";
    loginForm.removeAttribute("aria-busy");
  });
}
