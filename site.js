"use strict";

const storageKey = "dia-de-mimo:aniversarios:v1";
const dayMilliseconds = 24 * 60 * 60 * 1000;
const monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const find = (id) => document.getElementById(id);
const toast = find("toast");

function validDate(day, month) {
  return Number.isInteger(month) && Number.isInteger(day) && day >= 1 && day <= monthDays[month - 1];
}

function readBirthdays() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(saved)) {
      return saved.filter((item) => item && typeof item.id === "string" &&
        typeof item.name === "string" && item.name.trim() && validDate(item.day, item.month));
    }
  } catch {
    // The agenda can still be used in this tab when browser storage is unavailable.
  }
  return [];
}

let birthdays = readBirthdays();
let editingId = null;
let recipientId = null;
let toastTimer;

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 5800);
}

function storeBirthdays() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(birthdays));
    return true;
  } catch {
    return false;
  }
}

function currentDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function nextBirthday(birthday, today) {
  for (let year = today.getUTCFullYear(); ; year += 1) {
    const date = new Date(Date.UTC(year, birthday.month - 1, birthday.day));
    if (date.getUTCDate() === birthday.day && date >= today) return date;
  }
}

function timeUntil(days) {
  if (days === 0) return "É hoje!";
  if (days === 1) return "É amanhã";
  return "Em " + days + " dias";
}

const birthdayList = find("birthday-list");
const rowTemplate = find("birthday-row");

function renderAgenda() {
  const today = currentDay();
  const upcoming = birthdays
    .map((birthday) => ({ birthday, next: nextBirthday(birthday, today) }))
    .sort((first, second) => first.next - second.next ||
      first.birthday.name.localeCompare(second.birthday.name, "pt-BR"));

  const rows = upcoming.map(({ birthday, next }) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = birthday.id;
    row.querySelector(".date-day").textContent = String(birthday.day).padStart(2, "0");
    row.querySelector(".date-month").textContent = monthNames[birthday.month - 1];
    row.querySelector(".birthday-person").textContent = birthday.name;
    row.querySelector(".birthday-distance").textContent = timeUntil((next - today) / dayMilliseconds);
    row.querySelector('[data-action="edit"]').setAttribute("aria-label", "Editar aniversário de " + birthday.name);
    row.querySelector('[data-action="delete"]').setAttribute("aria-label", "Excluir aniversário de " + birthday.name);
    row.querySelector('[data-action="calendar"]').setAttribute("aria-label", "Baixar lembrete de " + birthday.name);
    row.querySelector('[data-action="present"]').setAttribute("aria-label", "Ver presentes para " + birthday.name);
    return row;
  });

  birthdayList.replaceChildren(...rows);
  birthdayList.hidden = rows.length === 0;
  find("agenda-empty").hidden = rows.length > 0;
}

function renderRecipient() {
  const birthday = birthdays.find((item) => item.id === recipientId);
  find("recipient-bar").hidden = !birthday;
  find("recipient-name").textContent = birthday?.name ?? "";
}

function visitSection(id) {
  const section = find(id);
  const heading = find(section.getAttribute("aria-labelledby"));
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
  section.scrollIntoView();
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
}

const birthdayDialog = find("birthday-dialog");
const birthdayForm = find("birthday-form");
const birthdayName = find("birthday-name");
const birthdayDay = find("birthday-day");
const birthdayMonth = find("birthday-month");

function openBirthday(birthday) {
  editingId = birthday?.id ?? null;
  birthdayForm.reset();
  birthdayName.setCustomValidity("");
  birthdayDay.setCustomValidity("");
  find("birthday-title").textContent = birthday ? "Editar aniversário" : "Adicionar aniversário";
  birthdayName.value = birthday?.name ?? "";
  birthdayDay.value = birthday?.day ?? "";
  birthdayMonth.value = birthday?.month ?? "";
  birthdayDialog.showModal();
}

function createId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => openBirthday());
});

birthdayName.addEventListener("input", () => birthdayName.setCustomValidity(""));
birthdayDay.addEventListener("input", () => birthdayDay.setCustomValidity(""));
birthdayMonth.addEventListener("change", () => birthdayDay.setCustomValidity(""));

birthdayForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = birthdayName.value.trim().replace(/\s+/g, " ");
  const day = Number(birthdayDay.value);
  const month = Number(birthdayMonth.value);

  if (!name) {
    birthdayName.setCustomValidity("Escreva um nome ou apelido.");
    birthdayName.reportValidity();
    return;
  }
  if (!validDate(day, month)) {
    birthdayDay.setCustomValidity("Escolha um dia válido para esse mês.");
    birthdayDay.reportValidity();
    return;
  }

  const birthday = { id: editingId ?? createId(), name, day, month };
  if (editingId) {
    birthdays = birthdays.map((item) => item.id === editingId ? birthday : item);
  } else {
    birthdays.push(birthday);
  }
  const saved = storeBirthdays();
  renderAgenda();
  renderRecipient();
  birthdayDialog.close();
  visitSection("agenda");
  notify(saved ? "Aniversário salvo na agenda." : "Aniversário guardado enquanto esta aba estiver aberta.");
});

function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let folded = "";
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      folded += "\r\n ";
      bytes = 1;
    }
    folded += character;
    bytes += length;
  }
  return folded;
}

function downloadCalendar(birthday) {
  const date = nextBirthday(birthday, currentDay()).toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const summary = ("Aniversário de " + birthday.name).replace(/[\\;,]/g, "\\$&");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dia de Mimo//Aniversarios//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + birthday.id + "@dia-de-mimo",
    "DTSTAMP:" + stamp,
    "DTSTART:" + date + "T090000",
    "DURATION:PT15M",
    "RRULE:FREQ=YEARLY",
    "SUMMARY:" + summary,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-P1D",
    "DESCRIPTION:" + summary + " é amanhã.",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ];
  const file = new Blob([lines.map(foldCalendarLine).join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lembrete-aniversario.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  notify("Abra o arquivo no seu calendário e confira o aviso da véspera.");
}

birthdayList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const birthday = birthdays.find((item) => item.id === button.closest(".birthday-row").dataset.id);
  if (!birthday) return;

  switch (button.dataset.action) {
    case "edit":
      openBirthday(birthday);
      break;
    case "delete":
      if (!confirm("Excluir o aniversário de " + birthday.name + " da agenda?")) break;
      birthdays = birthdays.filter((item) => item.id !== birthday.id);
      if (recipientId === birthday.id) recipientId = null;
      const saved = storeBirthdays();
      renderAgenda();
      renderRecipient();
      visitSection("agenda");
      notify(saved ? "Aniversário excluído da agenda." : "Aniversário removido nesta aba.");
      break;
    case "calendar":
      downloadCalendar(birthday);
      break;
    case "present":
      recipientId = birthday.id;
      renderRecipient();
      visitSection("presentes");
      break;
  }
});

find("clear-recipient").addEventListener("click", () => {
  recipientId = null;
  renderRecipient();
  filterButtons[0].focus();
});

const filterButtons = Array.from(document.querySelectorAll("[data-category]"));
const giftCards = Array.from(document.querySelectorAll(".gift-card"));
const budget = find("budget");

function filterGifts(category) {
  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.category === category));
  });

  let count = 0;
  giftCards.forEach((card) => {
    const categoryMatches = category === "todos" || card.dataset.type === category;
    const budgetMatches = !budget.value || Number(card.dataset.min) <= Number(budget.value);
    card.hidden = !(categoryMatches && budgetMatches);
    if (!card.hidden) count += 1;
  });
  find("no-results").hidden = count !== 0;
  find("filter-status").textContent = count === 1 ? "1 ideia encontrada." : count + " ideias encontradas.";
}

filterButtons.forEach((button) => button.addEventListener("click", () => filterGifts(button.dataset.category)));
budget.addEventListener("change", () => {
  filterGifts(filterButtons.find((button) => button.getAttribute("aria-pressed") === "true").dataset.category);
});
find("reset-filters").addEventListener("click", () => {
  budget.value = "";
  filterGifts("todos");
  filterButtons[0].focus();
});

const cardDialog = find("card-dialog");
const cardForm = find("card-form");
const cardTo = find("card-to");
const cardFrom = find("card-from");
const cardMessage = find("card-message");
const copyMessage = find("copy-message");
const shareCard = find("share-card");
const shareHelp = find("share-help");
const defaultShareHelp = shareHelp.textContent;
const messages = [
  "Que seu novo ano venha cheio de motivos para sorrir. Hoje é dia de celebrar você e agradecer pela alegria de ter você na minha vida!",
  "Separei um carinho para deixar seu dia ainda mais especial. Que venham dias leves, boas surpresas e muitas histórias para contar!",
  "Hoje eu queria te lembrar do quanto você é especial para mim. Que o seu dia seja cheio de abraços, risadas e momentos que você vai guardar com carinho."
];
let messageIndex = 0;
let cardText = "";

function updateCard() {
  const recipient = cardTo.value.trim();
  const sender = cardFrom.value.trim();
  const message = cardMessage.value.trim();
  const greeting = recipient ? "Feliz aniversário, " + recipient + "!" : "Feliz aniversário!";
  const signature = sender ? "Com carinho,\n" + sender : "";

  find("preview-title").textContent = greeting;
  find("preview-message").textContent = message;
  find("preview-from").textContent = signature;
  find("preview-from").hidden = !signature;
  cardText = [greeting, message, signature].filter(Boolean).join("\n\n");
  copyMessage.disabled = !message;
  shareCard.setAttribute("aria-disabled", String(!message));
  if (message) {
    shareCard.href = "https://wa.me/?text=" + encodeURIComponent(cardText);
  } else {
    shareCard.removeAttribute("href");
  }
  shareHelp.textContent = defaultShareHelp;
}

document.querySelectorAll("[data-gift]").forEach((button) => {
  button.addEventListener("click", () => {
    const recipient = birthdays.find((item) => item.id === recipientId);
    cardForm.reset();
    cardTo.value = recipient?.name ?? "";
    find("selected-gift").textContent = button.dataset.gift;
    messageIndex = 0;
    cardMessage.value = messages[messageIndex];
    updateCard();
    cardDialog.showModal();
  });
});

cardForm.addEventListener("submit", (event) => event.preventDefault());
cardForm.addEventListener("input", updateCard);
find("message-idea").addEventListener("click", () => {
  messageIndex = (messageIndex + 1) % messages.length;
  cardMessage.value = messages[messageIndex];
  updateCard();
});
copyMessage.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(cardText);
    shareHelp.textContent = "Mensagem copiada.";
  } catch {
    cardMessage.focus();
    cardMessage.select();
    shareHelp.textContent = "Use o atalho de copiar ou toque e segure sobre a mensagem selecionada.";
  }
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  birthdays = readBirthdays();
  renderAgenda();
  renderRecipient();
});
window.addEventListener("pageshow", renderAgenda);
renderAgenda();
