// ============================================================
// STUDYFLOW - APP.JS
// ============================================================

// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  "https://nmnelytqzrqvatkcosli.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_WSXxsnt8PGKn4iz1gvlVTA_qm-okWoB";

const { createClient } = supabase;

const sb = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// ============================================================
// VARIÁVEIS
// ============================================================

let currentUser = null;
let currentProfile = null;
let activities = [];

let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;

let calendarDate = new Date();

// ============================================================
// UTILITÁRIOS
// ============================================================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  if (!date) {
    return "Sem prazo";
  }

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "Data inválida";
  }

  return d.toLocaleDateString("pt-BR");
}

let toastTimer;

function showToast(message, type = "success", title = "Concluído") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  const icon = document.getElementById("toast-icon");
  const titleEl = document.getElementById("toast-title");
  const messageEl = document.getElementById("toast-message");

  const config = {
    success: { icon: "✓", title: title || "Concluído" },
    error: { icon: "!", title: title || "Não foi possível concluir" },
    warning: { icon: "⚠", title: title || "Atenção" },
    info: { icon: "i", title: title || "Informação" }
  };
  const current = config[type] || config.info;

  clearTimeout(toastTimer);
  toast.classList.remove("success", "error", "warning", "info", "show");
  void toast.offsetWidth;
  toast.classList.add(type in config ? type : "info", "show");
  if (icon) icon.textContent = current.icon;
  if (titleEl) titleEl.textContent = current.title;
  if (messageEl) messageEl.textContent = message;

  toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}


// ============================================================
// NAVEGAÇÃO
// ============================================================

function go(page) {
  document.querySelectorAll(".page").forEach((section) => {
    section.classList.add("hidden");
  });

  const target = document.getElementById(page);

  if (target) {
    target.classList.remove("hidden");
  }

  document.querySelectorAll("[data-p]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.p === page
    );
  });

  const titles = {
    dashboard: "Dashboard",
    tasks: "Atividades",
    calendar: "Calendário",
    tutor: "Tutor IA",
    music: "Study Music",
    settings: "Minha conta",
    admin: "Controle geral"
  };

  setText("title", titles[page] || "StudyFlow");

  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "tasks") {
    loadActivities();
  }

  if (page === "calendar") {
    renderCalendar();
  }

  if (page === "admin") {
    loadAdmin();
  }
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

async function checkUser() {
  const {
    data: { user },
    error
  } = await sb.auth.getUser();

  if (error) {
    console.error("Erro ao verificar usuário:", error);
    showLogin();
    return;
  }

  currentUser = user;

  if (!user) {
    showLogin();
    return;
  }

  showApp();

  await loadProfile();
  await loadDashboard();
  await loadSettings();
}

// ============================================================
// LOGIN / APP
// ============================================================

function showLogin() {
  document.body.classList.add("logged-out");

  const login = document.getElementById("auth");
  const app = document.getElementById("app");

  if (login) {
    login.classList.remove("hidden");
  }

  if (app) {
    app.classList.add("hidden");
  }
}

function showApp() {
  document.body.classList.remove("logged-out");

  const login = document.getElementById("auth");
  const app = document.getElementById("app");

  if (login) {
    login.classList.add("hidden");
  }

  if (app) {
    app.classList.remove("hidden");
  }
}

// ============================================================
// LOGIN
// ============================================================

async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    showToast(error.message, "error", "Ocorreu um erro");
    return;
  }

  await checkUser();
}

// ============================================================
// CADASTRO
// ============================================================

async function signup(email, password, phone = "") {
  const {
    data,
    error
  } = await sb.auth.signUp({
    email,
    password
  });

  if (error) {
    showToast(error.message, "error", "Ocorreu um erro");
    return;
  }

  showToast("Verifique seu e-mail para confirmar a conta.", "success", "Conta criada!");
}

// ============================================================
// LOGOUT
// ============================================================

async function logout() {
  const { error } = await sb.auth.signOut();

  if (error) {
    console.error(error);
  }

  currentUser = null;
  currentProfile = null;
  activities = [];

  showLogin();
}

// ============================================================
// PERFIL
// ============================================================

async function loadProfile() {
  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } = await sb
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Erro ao carregar perfil:",
      error
    );
    return;
  }

  currentProfile = data;

  const emailElement =
    document.getElementById("user-email");

  if (emailElement) {
    emailElement.textContent =
      currentProfile?.email ||
      currentUser.email ||
      "";
  }

  const adminButton =
    document.getElementById("admin-nav");

  if (adminButton) {
    const admin =
      currentProfile?.role === "admin";

    adminButton.classList.toggle(
      "hidden",
      !admin
    );

    adminButton.style.display =
      admin ? "flex" : "none";
  }

  console.log(
    "Perfil carregado:",
    currentProfile
  );
}

// ============================================================
// VERIFICAR ADMIN
// ============================================================

async function isAdmin() {
  if (!currentUser) {
    return false;
  }

  if (
    currentProfile &&
    currentProfile.role === "admin"
  ) {
    return true;
  }

  await loadProfile();

  return (
    currentProfile &&
    currentProfile.role === "admin"
  );
}

// ============================================================
// ATIVIDADES
// ============================================================

async function loadActivities() {
  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } = await sb
    .from("activities")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("due_date", {
      ascending: true,
      nullsFirst: false
    });

  if (error) {
    console.error(
      "Erro ao carregar atividades:",
      error
    );

    return;
  }

  activities = data || [];

  renderActivities();
  updateDashboardStats();
  renderUpcoming();
  renderCalendar();
}

// ============================================================
// RENDERIZAR ATIVIDADES
// ============================================================

function renderActivities() {
  const list =
    document.getElementById("list");

  if (!list) {
    return;
  }

  if (activities.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div>📚</div>
        <h3>Nenhuma atividade</h3>
        <p>
          Você ainda não cadastrou nenhuma atividade.
        </p>
      </div>
    `;

    return;
  }

  list.innerHTML = activities
    .map((activity) => {
      return `
        <div class="task-card ${
          activity.completed ? "completed" : ""
        }">

          <div class="task-main">

            <div class="task-check">
              <input
                type="checkbox"
                class="complete-task"
                data-id="${escapeHTML(activity.id)}"
                ${
                  activity.completed
                    ? "checked"
                    : ""
                }
              >
            </div>

            <div class="task-info">

              <h3>
                ${escapeHTML(
                  activity.title ||
                  "Sem título"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  activity.description ||
                  "Sem descrição"
                )}
              </p>

              <small>
                📅 ${
                  activity.due_date
                    ? formatDate(
                        activity.due_date
                      )
                    : "Sem prazo"
                }
              </small>

              ${
                activity.source === "moodle"
                  ? `
                    <span class="source-badge">
                      ☁ Moodle
                    </span>
                  `
                  : ""
              }

            </div>

            <button
              class="delete-task"
              data-id="${escapeHTML(
                activity.id
              )}"
              title="Excluir atividade"
            >
              🗑️
            </button>

          </div>

        </div>
      `;
    })
    .join("");

  document
    .querySelectorAll(".complete-task")
    .forEach((checkbox) => {
      checkbox.addEventListener(
        "change",
        async (event) => {
          await toggleActivity(
            event.target.dataset.id,
            event.target.checked
          );
        }
      );
    });

  document
    .querySelectorAll(".delete-task")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await deleteActivity(
            button.dataset.id
          );
        }
      );
    });
}

// ============================================================
// CRIAR ATIVIDADE
// ============================================================

async function createTask(
  title,
  dueDate,
  description = ""
) {
  if (!currentUser) {
    showToast("Entre na sua conta para continuar.", "warning", "Sessão necessária");
    return false;
  }

  title = String(title || "").trim();
  description =
    String(description || "").trim();

  if (!title) {
    showToast("Digite o nome da atividade.", "warning", "Nome obrigatório");
    return false;
  }

  const {
    error
  } = await sb
    .from("activities")
    .insert({
      user_id: currentUser.id,
      title,
      description,
      due_date: dueDate || null,
      source: "manual",
      completed: false
    });

  if (error) {
    console.error(
      "Erro ao criar atividade:",
      error
    );

    showToast(error.message || "Não foi possível criar a atividade.", "error", "Erro ao criar atividade");

    return false;
  }

  showToast(
    "Atividade criada com sucesso! ✅"
  );

  await loadActivities();

  return true;
}

// ============================================================
// CONCLUIR ATIVIDADE
// ============================================================

async function toggleActivity(
  id,
  completed
) {
  if (!currentUser) {
    return;
  }

  const {
    error
  } = await sb
    .from("activities")
    .update({
      completed
    })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(
      "Erro ao atualizar atividade:",
      error
    );

    showToast("Não foi possível atualizar a atividade.", "error", "Erro ao atualizar");

    return;
  }

  await loadActivities();
}

// ============================================================
// EXCLUIR ATIVIDADE
// ============================================================

function confirmAction(message = "Esta ação não poderá ser desfeita.") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageEl = document.getElementById("confirm-message");
    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");
    const close = document.getElementById("confirm-close");
    const overlay = document.getElementById("confirm-overlay");

    if (!modal || !ok || !cancel) { resolve(false); return; }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      close?.removeEventListener("click", onCancel);
      overlay?.removeEventListener("click", onCancel);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);

    if (messageEl) messageEl.textContent = message;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    close?.addEventListener("click", onCancel);
    overlay?.addEventListener("click", onCancel);
    setTimeout(() => ok.focus(), 20);
  });
}

async function deleteActivity(id) {
  if (!currentUser) {
    return;
  }

  const confirmed = await confirmAction(
    "A atividade será removida permanentemente da sua lista."
  );

  if (!confirmed) return;

  const {
    error
  } = await sb
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(
      "Erro ao excluir atividade:",
      error
    );

    showToast("Não foi possível excluir a atividade.", "error", "Erro ao excluir");

    return;
  }

  showToast(
    "Atividade excluída. 🗑️"
  );

  await loadActivities();
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
  if (!currentUser) {
    return;
  }

  await loadActivities();
}

// ============================================================
// ESTATÍSTICAS
// ============================================================

function updateDashboardStats() {
  const pending =
    activities.filter(
      (activity) =>
        !activity.completed
    );

  const done =
    activities.filter(
      (activity) =>
        activity.completed
    );

  const now = new Date();

  const limit = new Date(
    now.getTime() +
    48 * 60 * 60 * 1000
  );

  const urgent =
    pending.filter((activity) => {
      if (!activity.due_date) {
        return false;
      }

      const date =
        new Date(activity.due_date);

      return (
        date >= now &&
        date <= limit
      );
    });

  setText(
    "pending",
    pending.length
  );

  setText(
    "done",
    done.length
  );

  setText(
    "urgent",
    urgent.length
  );

  setText(
    "total",
    activities.length
  );

  // Atualiza o resumo visual do Dashboard
  const total = activities.length;
  const completed = done.length;
  const progress = total > 0
    ? Math.round((completed / total) * 100)
    : 0;

  const progressValue = document.getElementById(
    "dashboard-progress-value"
  );
  const progressBar = document.getElementById(
    "dashboard-progress-bar"
  );
  const progressLabel = document.getElementById(
    "dashboard-progress-label"
  );

  if (progressValue) {
    progressValue.textContent = `${progress}%`;
  }

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  if (progressLabel) {
    if (total === 0) {
      progressLabel.textContent = "Nenhuma atividade cadastrada ainda.";
    } else if (progress === 100) {
      progressLabel.textContent = "Tudo concluído. Excelente trabalho!";
    } else if (progress >= 70) {
      progressLabel.textContent = "Você está indo muito bem. Continue assim!";
    } else if (progress >= 40) {
      progressLabel.textContent = "Bom ritmo. Continue avançando!";
    } else {
      progressLabel.textContent = `${pending.length} atividade(s) ainda precisam da sua atenção.`;
    }
  }
}

// ============================================================
// PRÓXIMAS ENTREGAS
// ============================================================

function renderUpcoming() {
  const container =
    document.getElementById(
      "upcoming"
    );

  if (!container) {
    return;
  }

  const upcoming =
    activities
      .filter(
        (activity) =>
          !activity.completed
      )
      .sort((a, b) => {
        if (!a.due_date) {
          return 1;
        }

        if (!b.due_date) {
          return -1;
        }

        return (
          new Date(a.due_date) -
          new Date(b.due_date)
        );
      })
      .slice(0, 5);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state small">
        🎉 Tudo em dia!
      </div>
    `;

    return;
  }

  container.innerHTML =
    upcoming
      .map(
        (activity) => `
          <div class="upcoming-item">
            <div>
              <strong>
                ${escapeHTML(
                  activity.title ||
                  "Sem título"
                )}
              </strong>

              <span>
                ${
                  activity.due_date
                    ? formatDate(
                        activity.due_date
                      )
                    : "Sem prazo"
                }
              </span>
            </div>
          </div>
        `
      )
      .join("");
}

// ============================================================
// CALENDÁRIO
// ============================================================

function renderCalendar() {
  const calendar =
    document.getElementById("cal");

  const monthTitle =
    document.getElementById("month");

  if (
    !calendar ||
    !monthTitle
  ) {
    return;
  }

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();

  const monthName =
    calendarDate.toLocaleDateString(
      "pt-BR",
      {
        month: "long",
        year: "numeric"
      }
    );

  monthTitle.textContent =
    monthName
      .charAt(0)
      .toUpperCase() +
    monthName.slice(1);

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  let html = `
    <div class="calendar-weekdays">
      <div>Dom</div>
      <div>Seg</div>
      <div>Ter</div>
      <div>Qua</div>
      <div>Qui</div>
      <div>Sex</div>
      <div>Sáb</div>
    </div>

    <div class="calendar-grid">
  `;

  for (
    let i = 0;
    i < firstDay;
    i++
  ) {
    html += `
      <div class="calendar-day empty"></div>
    `;
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const dateString =
      `${year}-${String(
        month + 1
      ).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

    const dayActivities =
      activities.filter(
        (activity) => {
          if (!activity.due_date) {
            return false;
          }

          return String(
            activity.due_date
          ).startsWith(
            dateString
          );
        }
      );

    html += `
      <div class="calendar-day">

        <div class="calendar-number">
          ${day}
        </div>

        <div class="calendar-events">

          ${dayActivities
            .map(
              (activity) => `
                <div
                  class="calendar-event ${
                    activity.completed
                      ? "completed"
                      : ""
                  }"
                  title="${escapeHTML(
                    activity.title
                  )}"
                >
                  ${escapeHTML(
                    activity.title
                  )}
                </div>
              `
            )
            .join("")}

        </div>

      </div>
    `;
  }

  html += `
    </div>
  `;

  calendar.innerHTML = html;
}

// ============================================================
// POMODORO
// ============================================================

function updateTimer() {
  const timer =
    document.getElementById(
      "timer"
    );

  if (!timer) {
    return;
  }

  const minutes =
    Math.floor(
      timerSeconds / 60
    );

  const seconds =
    timerSeconds % 60;

  timer.textContent =
    `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(
      2,
      "0"
    )}`;
}

function startPomodoro() {
  if (timerRunning) {
    return;
  }

  timerRunning = true;

  timerInterval =
    setInterval(() => {
      if (timerSeconds <= 0) {
        clearInterval(
          timerInterval
        );

        timerRunning = false;

        showToast("Seu ciclo terminou. Faça uma pausa antes do próximo.", "success", "Pomodoro concluído!");

        timerSeconds =
          25 * 60;

        updateTimer();

        return;
      }

      timerSeconds--;

      updateTimer();
    }, 1000);
}

function resetPomodoro() {
  clearInterval(
    timerInterval
  );

  timerRunning = false;

  timerSeconds =
    25 * 60;

  updateTimer();
}

// ============================================================
// TUTOR IA
// ============================================================

async function askTutor(message, activity = "") {
  if (!message.trim()) return "Digite uma pergunta.";
  return "🛠️ O Tutor IA está temporariamente em manutenção. Voltaremos em breve.";
}

// ============================================================
// SPOTIFY// ============================================================
// SPOTIFY
// ============================================================

function loadSpotify(url) {
  const player =
    document.getElementById(
      "player"
    );

  if (!player) {
    return;
  }

  if (!url) {
    player.innerHTML =
      "Cole uma URL do Spotify.";

    return;
  }

  try {
    const parsed =
      new URL(url);

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const type = parts[0];
    const id = parts[1];

    const allowed = [
      "track",
      "album",
      "playlist",
      "artist",
      "episode",
      "show"
    ];

    if (
      parsed.hostname !==
        "open.spotify.com" ||
      !allowed.includes(type) ||
      !id
    ) {
      player.innerHTML =
        "URL do Spotify inválida.";

      return;
    }

    player.innerHTML = `
      <iframe
        src="https://open.spotify.com/embed/${type}/${id}"
        width="100%"
        height="352"
        frameborder="0"
        allowfullscreen=""
        allow="
          autoplay;
          clipboard-write;
          encrypted-media;
          fullscreen;
          picture-in-picture
        "
        loading="lazy">
      </iframe>
    `;
  } catch (error) {
    console.error(error);

    player.innerHTML =
      "URL inválida.";
  }
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================

async function loadSettings() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from("notification_preferences")
    .select("phone, notify_new, notify_due")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar notificações:", error);
    return;
  }

  const phone = document.getElementById("phone");
  const newNotify = document.getElementById("new-notify");
  const dueNotify = document.getElementById("due-notify");

  if (phone) phone.value = data?.phone || "";
  if (newNotify) newNotify.checked = data?.notify_new ?? true;
  if (dueNotify) dueNotify.checked = data?.notify_due ?? true;
}

// ============================================================
// ADMIN// ============================================================
// ADMIN
// ============================================================

async function loadAdmin() {
  const admin =
    await isAdmin();

  if (!admin) {
    showToast("Sua conta não possui acesso administrativo.", "error", "Acesso negado");

    go("dashboard");

    return;
  }

  await loadAdminStats();
  await loadAdminUsers();
}

// ============================================================
// ADMIN - ESTATÍSTICAS
// ============================================================

async function loadAdminStats() {
  const { data: profiles, error: profileError } = await sb
    .from("profiles")
    .select("id, role");

  if (!profileError) {
    const total = profiles?.length || 0;
    const students = (profiles || []).filter((profile) => profile.role !== "admin").length;
    const admins = (profiles || []).filter((profile) => profile.role === "admin").length;

    setText("au", total);
    setText("astudents", students);
    setText("aadmins", admins);
    setText("admin-user-count", total);
  }

  const { data: activityRows, error: activityError } = await sb
    .from("activities")
    .select("id, completed");

  if (!activityError) {
    const totalActivities = activityRows?.length || 0;
    const pendingActivities = (activityRows || []).filter((activity) => !activity.completed).length;

    setText("at", totalActivities);
    setText("apending", pendingActivities);
  }
}

// ============================================================
// ADMIN - USUÁRIOS
// ============================================================

async function loadAdminUsers() {
  const container = document.getElementById("users");
  if (!container) return;

  container.innerHTML = `<div class="admin-loading">Carregando usuários...</div>`;

  const { data: profiles, error } = await sb
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar usuários:", error);
    container.innerHTML = `<div class="admin-error">Não foi possível carregar os usuários.</div>`;
    return;
  }

  const { data: prefs, error: prefsError } = await sb
    .from("notification_preferences")
    .select("user_id, phone");

  if (prefsError) console.warn("Não foi possível carregar telefones:", prefsError);

  const phones = new Map((prefs || []).map((item) => [item.user_id, item.phone]));

  if (!profiles?.length) {
    container.innerHTML = `<div class="empty-state"><div>👥</div><h3>Nenhum usuário encontrado</h3></div>`;
    setText("admin-user-count", 0);
    return;
  }

  setText("admin-user-count", profiles.length);

  container.innerHTML = profiles.map((profile) => {
    const email = profile.email || "Sem e-mail";
    const initials = email.charAt(0).toUpperCase();
    const isAdmin = profile.role === "admin";
    const phone = phones.get(profile.id);
    const created = profile.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—";

    return `
      <article class="admin-user-card">
        <div class="admin-user-avatar ${isAdmin ? "admin" : ""}">${escapeHTML(initials)}</div>
        <div class="admin-user-main">
          <div class="admin-user-top">
            <strong title="${escapeHTML(email)}">${escapeHTML(email)}</strong>
            ${isAdmin ? `<span class="admin-badge">ADMIN</span>` : `<span class="student-badge">ALUNO</span>`}
          </div>
          <div class="admin-user-meta">
            <span>📅 Cadastro: ${created}</span>
            <span>${phone ? `📱 ${escapeHTML(phone)}` : `📱 Sem telefone`}</span>
          </div>
        </div>
        <div class="admin-user-arrow">›</div>
      </article>
    `;
  }).join("");
}

// ============================================================
// CONTROLES DO CALENDÁRIO
// ============================================================

function setupCalendarControls() {
  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  const today = document.getElementById("calendar-today");

  prev?.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  next?.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  today?.addEventListener("click", () => {
    calendarDate = new Date();
    renderCalendar();
  });
}

// ============================================================
// EVENTOS ADMIN// ============================================================
// EVENTOS ADMIN
// ============================================================

function setupAdminEvents() {
  const refresh = document.getElementById("refresh-admin");
  if (refresh) refresh.addEventListener("click", loadAdmin);
}

// ============================================================
// MODAL DE ATIVIDADE// ============================================================
// MODAL DE ATIVIDADE
// ============================================================

function setupTaskModal() {
  const newTask =
    document.getElementById(
      "newtask"
    );

  const addButton =
    document.getElementById(
      "add"
    );

  const taskModal =
    document.getElementById(
      "task-modal"
    );

  const taskForm =
    document.getElementById(
      "task-form"
    );

  const closeModal =
    document.getElementById(
      "close-modal"
    );

  const cancelTask =
    document.getElementById(
      "cancel-task"
    );

  const modalOverlay =
    document.getElementById(
      "modal-overlay"
    );

  function openTaskModal() {
    if (!taskModal) {
      return;
    }

    taskModal.classList.remove(
      "hidden"
    );

    const titleInput =
      document.getElementById(
        "task-title"
      );

    if (titleInput) {
      setTimeout(() => {
        titleInput.focus();
      }, 100);
    }
  }

  function closeTaskModal() {
    if (!taskModal) {
      return;
    }

    taskModal.classList.add(
      "hidden"
    );

    if (taskForm) {
      taskForm.reset();
    }
  }

  if (newTask) {
    newTask.addEventListener(
      "click",
      openTaskModal
    );
  }

  if (addButton) {
    addButton.addEventListener(
      "click",
      openTaskModal
    );
  }

  if (closeModal) {
    closeModal.addEventListener(
      "click",
      closeTaskModal
    );
  }

  if (cancelTask) {
    cancelTask.addEventListener(
      "click",
      closeTaskModal
    );
  }

  if (modalOverlay) {
    modalOverlay.addEventListener(
      "click",
      closeTaskModal
    );
  }

  if (taskForm) {
    taskForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const title =
          document
            .getElementById(
              "task-title"
            )
            ?.value
            .trim() || "";

        const description =
          document
            .getElementById(
              "task-description"
            )
            ?.value
            .trim() || "";

        const dueDate =
          document
            .getElementById(
              "task-date"
            )
            ?.value || null;

        const success =
          await createTask(
            title,
            dueDate,
            description
          );

        if (success) {
          closeTaskModal();
        }
      }
    );
  }
}

// ============================================================
// PESQUISA
// ============================================================

function setupSearch() {
  const search =
    document.getElementById(
      "search"
    );

  if (!search) {
    return;
  }

  search.addEventListener(
    "input",
    () => {
      const term =
        search.value
          .toLowerCase()
          .trim();

      document
        .querySelectorAll(
          ".task-card"
        )
        .forEach((card) => {
          card.style.display =
            card.textContent
              .toLowerCase()
              .includes(term)
              ? ""
              : "none";
        });
    }
  );
}

// ============================================================
// CHAT IA
// ============================================================

function setupTutor() {
  const chatForm =
    document.getElementById(
      "chat"
    );

  if (!chatForm) {
    return;
  }

  chatForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const input =
        document.getElementById(
          "question"
        );

      const messages =
        document.getElementById(
          "messages"
        );

      if (
        !input ||
        !messages
      ) {
        return;
      }

      const question =
        input.value.trim();

      if (!question) {
        return;
      }

      messages.innerHTML += `
        <div class="bubble user">
          ${escapeHTML(question)}
        </div>
      `;

      input.value = "";

      const activity =
        document
          .getElementById(
            "activity-text"
          )
          ?.value || "";

      const thinking =
        document.createElement(
          "div"
        );

      thinking.className =
        "bubble";

      thinking.textContent =
        "Pensando... 🤖";

      messages.appendChild(
        thinking
      );

      const answer =
        await askTutor(
          question,
          activity
        );

      thinking.textContent =
        answer;

      messages.scrollTop =
        messages.scrollHeight;
    }
  );
}

// ============================================================
// EXPLICAR ATIVIDADE
// ============================================================

function setupExplain() {
  const explain =
    document.getElementById(
      "explain"
    );

  if (!explain) {
    return;
  }

  explain.addEventListener(
    "click",
    async () => {
      const activity =
        document
          .getElementById(
            "activity-text"
          )
          ?.value || "";

      if (!activity.trim()) {
        showToast("Cole primeiro o enunciado da atividade.", "warning", "Atividade necessária");

        return;
      }

      go("tutor");

      const messages =
        document.getElementById(
          "messages"
        );

      if (!messages) {
        return;
      }

      const thinking =
        document.createElement(
          "div"
        );

      thinking.className =
        "bubble";

      thinking.textContent =
        "Vou analisar sua atividade... 🤖";

      messages.appendChild(
        thinking
      );

      const answer =
        await askTutor(
          "Explique essa atividade para mim.",
          activity
        );

      thinking.textContent =
        answer;
    }
  );
}

// ============================================================
// SPOTIFY EVENTS
// ============================================================

function setupSpotify() {
  const button =
    document.getElementById(
      "spotify-load"
    );

  const input =
    document.getElementById(
      "spotify-url"
    );

  if (button && input) {
    button.addEventListener(
      "click",
      () => {
        loadSpotify(
          input.value.trim()
        );
      }
    );
  }

  document
    .querySelectorAll(
      ".musiclink"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const url =
            button.dataset.url;

          if (input) {
            input.value = url;
          }

          loadSpotify(url);
        }
      );
    });
}

// ============================================================
// CONFIGURAÇÕES / NOTIFICAÇÕES
// ============================================================

function setupSettings() {
  const save = document.getElementById("save-notify");
  if (!save) return;

  save.addEventListener("click", async () => {
    if (!currentUser) {
      showToast("Você precisa estar logado.");
      return;
    }

    const phone = document.getElementById("phone")?.value.trim() || "";
    const notifyNew = document.getElementById("new-notify")?.checked ?? true;
    const notifyDue = document.getElementById("due-notify")?.checked ?? true;

    save.disabled = true;
    const originalText = save.textContent;
    save.textContent = "Salvando...";

    try {
      const { error } = await sb
        .from("notification_preferences")
        .upsert({
          user_id: currentUser.id,
          phone,
          notify_new: notifyNew,
          notify_due: notifyDue
        }, { onConflict: "user_id" });

      if (error) throw error;

      await loadSettings();
      showToast("Telefone e notificações salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar notificações:", error);
      showToast("Não foi possível salvar as notificações.");
    } finally {
      save.disabled = false;
      save.textContent = originalText;
    }
  });
}

// ============================================================
// DOM LOADED// ============================================================
// DOM LOADED
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // Verificar sessão
    checkUser();

    // Login
    const authForm =
      document.getElementById(
        "auth-form"
      );

    const toggle =
      document.getElementById(
        "toggle"
      );

    let registerMode = false;

    if (toggle) {
      toggle.addEventListener(
        "click",
        () => {
          registerMode =
            !registerMode;

          const title =
            document.getElementById(
              "auth-title"
            );

          const button =
            authForm?.querySelector(
              "button[type='submit']"
            );

          if (registerMode) {
            if (title) {
              title.textContent =
                "Crie seu espaço de estudos.";
            }

            if (button) {
              button.textContent =
                "Criar conta";
            }

            toggle.textContent =
              "Já tenho uma conta";
          } else {
            if (title) {
              title.textContent =
                "Estude melhor. Entregue no prazo.";
            }

            if (button) {
              button.textContent =
                "Entrar";
            }

            toggle.textContent =
              "Ainda não tenho uma conta";
          }
        }
      );
    }

    if (authForm) {
      authForm.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          const email =
            document
              .getElementById(
                "email"
              )
              ?.value
              .trim() || "";

          const password =
            document.getElementById(
              "password"
            )?.value || "";

          if (
            !email ||
            !password
          ) {
            showToast("Preencha o e-mail e a senha.", "warning", "Dados incompletos");

            return;
          }

          const submitButton = authForm.querySelector("button[type='submit']");
          const originalText = submitButton?.textContent || "Entrar";
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = registerMode ? "Criando conta..." : "Entrando...";
            submitButton.classList.add("loading");
          }

          try {
            if (registerMode) {
              await signup(email, password);
            } else {
              await login(email, password);
            }
          } finally {
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = originalText;
              submitButton.classList.remove("loading");
            }
          }
        }
      );
    }

    // Navegação
    document
      .querySelectorAll(
        "[data-p]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            go(
              button.dataset.p
            );
          }
        );
      });

    // Logout
    const logoutButton =
      document.getElementById(
        "logout"
      );

    if (logoutButton) {
      logoutButton.addEventListener(
        "click",
        logout
      );
    }

    // Pomodoro
    const startButton =
      document.getElementById(
        "start"
      );

    if (startButton) {
      startButton.addEventListener(
        "click",
        startPomodoro
      );
    }

    const resetButton =
      document.getElementById(
        "reset"
      );

    if (resetButton) {
      resetButton.addEventListener(
        "click",
        resetPomodoro
      );
    }

    // Modal
    setupTaskModal();

    // Pesquisa
    setupSearch();

    // Tutor
    setupTutor();

    setupExplain();

    // Spotify
    setupSpotify();

    // Configurações
    setupSettings();

    // Calendário
    setupCalendarControls();

// ===============================
// MOODLE
// ===============================

const syncButton = document.getElementById("sync");

if (syncButton) {
  syncButton.addEventListener("click", async () => {
    if (!currentUser) {
      showToast("Entre na sua conta para sincronizar.", "warning", "Sessão necessária");
      return;
    }

    const moodleUrl =
      document.getElementById("moodle-url")?.value.trim() || "";

    const moodleToken =
      document.getElementById("moodle-token")?.value.trim() || "";

    if (!moodleUrl || !moodleToken) {
      showToast("Informe a URL e o token do Moodle.", "warning", "Dados do Moodle");
      return;
    }

    syncButton.disabled = true;
    syncButton.textContent = "Sincronizando...";

    try {
      const { data, error } = await sb.functions.invoke(
        "moodle-sync",
        {
          body: {
            moodle_url: moodleUrl,
            moodle_token: moodleToken
          }
        }
      );

      if (error) {
        console.error("Erro no Moodle:", error);
        throw error;
      }

      const imported = data?.imported ?? 0;

      showToast(`${imported} atividades foram importadas.`, "success", "Moodle sincronizado!");

      await loadActivities();

    } catch (error) {
      console.error("Erro ao sincronizar Moodle:", error);

      showToast(error.message || "Não foi possível sincronizar o Moodle.", "error", "Erro no Moodle");
    } finally {
      syncButton.disabled = false;
      syncButton.textContent = "Sincronizar agora";
    }
  });
}

    // Admin
    setupAdminEvents();

    // Timer
    updateTimer();
   
   }
);

// ============================================================
// FUNÇÕES GLOBAIS
// ============================================================

window.go = go;
window.createTask = createTask;
window.logout = logout;
window.startPomodoro = startPomodoro;
window.resetPomodoro = resetPomodoro;
window.loadAdmin = loadAdmin;
window.askTutor = askTutor;
window.loadSpotify = loadSpotify;

/* ================================================================
   ██╗      ██████╗  ██████╗██╗  ██╗
   ██║     ██╔═══██╗██╔════╝██║ ██╔╝
   ██║     ██║   ██║██║     █████╔╝ 
   ██║     ██║   ██║██║     ██╔═██╗ 
   ███████╗╚██████╔╝╚██████╗██║  ██╗
   ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝
   ================================================================
   coded by lock · dark query
   ================================================================ */