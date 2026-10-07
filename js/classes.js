// ============================================================
// STUDYFLOW - TURMAS (professor, aluno e admin)
// ============================================================

const isTeacher = () => ["teacher", "admin"].includes(currentProfile?.role);
const $id = (id) => document.getElementById(id);
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo");
const E = escapeHTML;
const cls = { classId: null, assignmentId: null };

function flag(v, label = "") {
  if (v == null) return `<span class="flag flag-neutral">—${label}</span>`;
  const k = v >= 60 ? "high" : v >= 30 ? "mid" : "low";
  return `<span class="flag flag-${k}">${v}%${label}</span>`;
}

async function loadClasses() {
  const root = $id("classes-root");
  if (!root || !currentUser) return;
  root.innerHTML = `<div class="classes-loading"><span class="loading-dot"></span>Carregando seu espaço...</div>`;
  try {
    root.innerHTML = cls.classId ? await classDetailHTML() : await classListHTML();
  } catch (e) {
    console.error("Erro em Turmas:", e);
    root.innerHTML = `<div class="class-error-card"><div class="class-error-icon">!</div><div><strong>Não foi possível carregar as turmas.</strong><p>Verifique sua conexão e tente novamente.</p><button class="soft-btn" data-act="reload">Tentar novamente</button></div></div>`;
  }
}

async function classListHTML() {
  if (!isTeacher()) {
    const { data, error } = await sb
      .from("class_members")
      .select("classes(id,name,subjects(name))")
      .eq("student_id", currentUser.id);
    if (error) throw error;

    const rows = (data || []).map((r) => r.classes).filter(Boolean);
    const pending = currentProfile?.teacher_requested
      ? `<div class="request-banner"><span>◷</span><div><strong>Pedido de professor em análise</strong><p>Um administrador precisa aprovar seu perfil.</p></div></div>` : "";

    if (!rows.length) {
      return `<div class="classes-hero"><div><span class="eyebrow">MINHAS TURMAS</span><h1>Seu espaço de aprendizagem</h1><p>Quando um professor adicionar seu e-mail a uma turma, ela aparecerá aqui.</p></div><div class="classes-hero-icon">🎓</div></div>${pending}<div class="class-empty"><div class="class-empty-icon">＋</div><h3>Nenhuma turma ainda</h3><p>Você ainda não está matriculado em nenhuma turma.</p></div>`;
    }

    return `<div class="classes-hero"><div><span class="eyebrow">MINHAS TURMAS</span><h1>Suas turmas</h1><p>Acompanhe atividades, prazos e entregas em um só lugar.</p></div><div class="classes-hero-stat"><strong>${rows.length}</strong><span>${rows.length === 1 ? "turma" : "turmas"}</span></div></div>${pending}<div class="class-section-title"><div><span class="eyebrow">ACOMPANHAMENTO</span><h2>Turmas em que você está</h2></div></div><div class="student-class-grid">${rows.map((c) => `
      <button class="class-card student-class-card" data-act="open-class" data-id="${E(c.id)}">
        <span class="class-card-accent"></span>
        <div class="class-card-top"><span class="class-subject">${E(c.subjects?.name || "Disciplina")}</span><span class="class-arrow">→</span></div>
        <h3>${E(c.name)}</h3>
        <p>Ver atividades e entregas desta turma</p>
        <span class="class-card-link">Abrir turma <b>→</b></span>
      </button>`).join("")}</div>`;
  }

  const { data, error } = await sb.from("subjects").select("id,name,classes(id,name)").order("created_at");
  if (error) throw error;
  const subjects = data || [];
  const totalClasses = subjects.reduce((n, s) => n + (s.classes || []).length, 0);

  return `<div class="classes-hero teacher-hero"><div><span class="eyebrow">GESTÃO ACADÊMICA</span><h1>Turmas</h1><p>Organize disciplinas, alunos e atividades com uma visão clara da sua sala.</p></div><div class="teacher-hero-actions"><div class="hero-mini-stat"><strong>${subjects.length}</strong><span>disciplinas</span></div><div class="hero-mini-stat"><strong>${totalClasses}</strong><span>turmas</span></div></div></div>
  <div class="create-subject-card"><div class="create-subject-icon">＋</div><div class="create-subject-copy"><span class="eyebrow">NOVO ESPAÇO</span><h2>Criar disciplina</h2><p>Comece criando uma disciplina para organizar suas turmas.</p></div><div class="create-subject-form"><input id="subject-name" placeholder="Ex.: Ciências da Natureza" aria-label="Nome da disciplina"><button class="primary-btn" data-act="new-subject">Criar disciplina</button></div></div>
  <div class="class-section-title"><div><span class="eyebrow">ESTRUTURA</span><h2>Suas disciplinas</h2></div></div>
  <div class="subject-stack">${subjects.length ? subjects.map((s) => `
    <section class="subject-panel">
      <div class="subject-panel-head"><div><span class="subject-icon">▦</span><div class="subject-heading"><span class="eyebrow">DISCIPLINA</span><h3>${E(s.name)}</h3></div></div><span class="subject-count">${(s.classes || []).length} ${(s.classes || []).length === 1 ? "turma" : "turmas"}</span></div>
      <div class="teacher-class-grid">${(s.classes || []).length ? (s.classes || []).map((c) => `
        <button class="class-card teacher-class-card" data-act="open-class" data-id="${E(c.id)}"><div class="class-card-top"><span class="class-status"><i></i> Ativa</span><span class="class-arrow">→</span></div><h3>${E(c.name)}</h3><p>Gerenciar alunos, atividades e entregas</p><span class="class-card-link">Gerenciar turma <b>→</b></span></button>`).join("") : `<div class="subject-empty"><span>＋</span><div><strong>Nenhuma turma nesta disciplina</strong><p>Crie a primeira turma abaixo.</p></div></div>`}</div>
      <div class="new-class-row"><input id="class-name-${E(s.id)}" placeholder="Ex.: 2º Ano B" aria-label="Nome da nova turma"><button class="outline-btn" data-act="new-class" data-id="${E(s.id)}">＋ Adicionar turma</button></div>
    </section>`).join("") : `<div class="class-empty"><div class="class-empty-icon">📚</div><h3>Nenhuma disciplina criada</h3><p>Crie sua primeira disciplina para começar.</p></div>`}</div>`;
}

async function classDetailHTML() {
  const { data: c, error } = await sb
    .from("classes").select("id,name,subjects(name)").eq("id", cls.classId).single();
  if (error) throw error;

  const { data: list, error: assignmentError } = await sb
    .from("assignments").select("*").eq("class_id", cls.classId).order("created_at", { ascending: false });
  if (assignmentError) throw assignmentError;
  const assignments = list || [];

  const back = `<button class="back-link" data-act="back">← Voltar para turmas</button>`;
  const header = `<div class="class-detail-hero"><div><span class="eyebrow">${E(c.subjects?.name || "DISCIPLINA")}</span><h1>${E(c.name)}</h1><p>Central da turma: alunos, atividades e entregas.</p></div><div class="class-detail-icon">🎓</div></div>`;

  if (!isTeacher()) {
    const { data: mine } = await sb.from("submissions")
      .select("assignment_id,content,submitted_at").eq("student_id", currentUser.id);
    const by = new Map((mine || []).map((s) => [s.assignment_id, s]));
    return `${back}${header}<div class="detail-stat-row"><div><span>Atividades</span><strong>${assignments.length}</strong></div><div><span>Entregues</span><strong>${assignments.filter(a => by.has(a.id)).length}</strong></div><div><span>Pendentes</span><strong>${assignments.filter(a => !by.has(a.id)).length}</strong></div></div><div class="detail-section-title"><div><span class="eyebrow">ATIVIDADES</span><h2>O que você precisa entregar</h2></div></div><div class="assignment-stack">${assignments.length ? assignments.map((a) => {
      const s = by.get(a.id);
      return `<article class="assignment-card ${s ? "is-submitted" : "is-pending"}"><div class="assignment-card-head"><div><span class="assignment-status">${s ? "✓ Entregue" : "• Pendente"}</span><h3>${E(a.title)}</h3></div><span class="assignment-date">📅 ${fmtDate(a.due_date)}</span></div><p>${E(a.description || "Sem descrição adicionada.")}</p><textarea id="sub-${E(a.id)}" class="submission-input" placeholder="Escreva sua resposta...">${E(s?.content || "")}</textarea><div class="submission-actions"><div>${s ? `<span class="submitted-meta">Enviado em ${new Date(s.submitted_at).toLocaleString("pt-BR")}</span>` : `<span class="submitted-meta">Sua resposta ficará registrada nesta atividade.</span>`}</div><button class="primary-btn" data-act="submit" data-id="${E(a.id)}" data-has="${s ? 1 : 0}">${s ? "Reenviar resposta" : "Enviar resposta"}</button></div></article>`;
    }).join("") : `<div class="class-empty"><div class="class-empty-icon">📝</div><h3>Nenhuma atividade publicada</h3><p>Quando o professor publicar uma atividade, ela aparecerá aqui.</p></div>`}</div>`;
  }

  const { data: members, error: membersError } = await sb.from("class_members").select("email,student_id").eq("class_id", cls.classId);
  if (membersError) throw membersError;
  const emails = new Map((members || []).map((m) => [m.student_id, m.email]));
  const submittedForClass = cls.assignmentId ? await sb.from("submissions").select("*").eq("assignment_id", cls.assignmentId) : { data: [] };
  const assignmentIds = assignments.map((a) => a.id);
  const { count: totalSubmissions } = assignmentIds.length ? await sb.from("submissions").select("id", { count: "exact", head: true }).in("assignment_id", assignmentIds) : { count: 0 };
  const selectedAssignment = assignments.find(a => a.id === cls.assignmentId);

  const studentsHTML = `<section class="detail-panel"><div class="detail-panel-head"><div><span class="eyebrow">TURMA</span><h2>Alunos</h2><p>${members.length} ${members.length === 1 ? "aluno matriculado" : "alunos matriculados"}</p></div><span class="panel-number">${members.length}</span></div><div class="student-roster">${members.length ? members.map((m) => `<div class="student-row"><span class="student-avatar">${E((m.email || "A").charAt(0).toUpperCase())}</span><div class="student-row-main"><strong>${E(m.email)}</strong><small>${m.student_id ? "Conta vinculada" : "Aguardando cadastro"}</small></div><span class="student-state ${m.student_id ? "ok" : "waiting"}">${m.student_id ? "Ativo" : "Pendente"}</span><button class="danger-icon-btn" data-act="remove-student" data-id="${E(m.email)}" title="${m.student_id ? "Remover aluno da turma" : "Cancelar convite"}" aria-label="${m.student_id ? "Remover aluno da turma" : "Cancelar convite"}">×</button></div>`).join("") : `<div class="mini-empty">Nenhum aluno adicionado ainda.</div>`}</div><div class="add-students-box"><textarea id="student-emails" placeholder="Adicione e-mails, um por linha ou separados por vírgula"></textarea><button class="outline-btn" data-act="add-students">＋ Adicionar alunos</button></div></section>`;

  const newAssign = `<section class="create-assignment-card"><div class="create-assignment-icon">✦</div><div class="create-assignment-copy"><span class="eyebrow">PUBLICAR</span><h2>Nova atividade</h2><p>Crie uma atividade e defina o prazo de entrega para a turma.</p></div><div class="assignment-form-grid"><input id="as-title" placeholder="Título da atividade"><input id="as-date" type="date"><textarea id="as-desc" placeholder="Descrição, instruções ou pergunta"></textarea><button class="primary-btn" data-act="new-assignment">Publicar atividade</button></div></section>`;

  let subsHTML = "";
  if (cls.assignmentId) {
    const subs = submittedForClass.data || [];
    subsHTML = `<section class="submissions-panel"><div class="submissions-head"><div><span class="eyebrow">ACOMPANHAMENTO</span><h2>Entregas</h2><p>${subs.length} ${subs.length === 1 ? "entrega recebida" : "entregas recebidas"}${selectedAssignment ? ` · ${E(selectedAssignment.title)}` : ""}</p></div><button class="primary-btn analysis-btn" data-act="analyze">✦ Analisar com IA</button></div><div class="analysis-note"><span>i</span><p>A análise ajuda o professor a identificar padrões e dar feedback. O indicador de similaridade/IA é apenas um sinal estatístico e nunca deve ser tratado como prova.</p></div><div class="submission-list">${subs.length ? subs.map((s) => `<article class="submission-card"><div class="submission-card-head"><div class="submission-student"><span class="student-avatar">${E((emails.get(s.student_id) || "A").charAt(0).toUpperCase())}</span><div><strong>${E(emails.get(s.student_id) || "Aluno")}</strong><small>${s.submitted_at ? `Enviado em ${new Date(s.submitted_at).toLocaleString("pt-BR")}` : "Entrega registrada"}</small></div></div><span class="delivery-badge">✓ Recebida</span></div><div class="submission-content">${E(s.content)}</div><div class="submission-metrics"><div><span>Similaridade</span>${flag(s.similarity)}</div><div><span>Indicador de IA</span>${s.ai_indicator == null ? `<span class="flag flag-neutral">Pendente</span>` : flag(s.ai_indicator)}</div></div>${s.analysis ? `<div class="ai-result"><div class="ai-result-title"><span>✦</span><strong>Análise da IA</strong></div><div class="ai-result-grid"><div><span>Nota sugerida</span><b>${E(String(s.analysis.suggested_grade ?? s.analysis.grade ?? "—"))}</b></div><div><span>Resumo</span><p>${E(s.analysis.summary || s.analysis.feedback || s.analysis.note || "Análise registrada.")}</p></div></div></div>` : ""}</article>`).join("") : `<div class="mini-empty large">Nenhuma entrega ainda. Assim que um aluno enviar a atividade, ela aparecerá aqui.</div>`}</div></section>`;
  }

  return `${back}${header}<div class="detail-stat-row"><div><span>Alunos</span><strong>${members.length}</strong></div><div><span>Atividades</span><strong>${assignments.length}</strong></div><div><span>Entregas recebidas</span><strong>${totalSubmissions || 0}</strong></div></div>${studentsHTML}${newAssign}<section class="detail-section-title"><div><span class="eyebrow">ATIVIDADES</span><h2>Publicações da turma</h2></div></section><div class="teacher-assignment-stack">${assignments.length ? assignments.map((a) => `<article class="teacher-assignment-card ${cls.assignmentId === a.id ? "selected" : ""}"><div class="teacher-assignment-main"><span class="assignment-status">${a.due_date && new Date(`${a.due_date}T23:59:59`) < new Date() ? "Prazo encerrado" : "Em andamento"}</span><h3>${E(a.title)}</h3><p>${E(a.description || "Sem descrição adicionada.")}</p></div><div class="teacher-assignment-side"><span>📅 ${fmtDate(a.due_date)}</span><div class="assignment-actions"><button class="outline-btn" data-act="open-assignment" data-id="${E(a.id)}">${cls.assignmentId === a.id ? "Ocultar entregas" : "Ver entregas"} <b>→</b></button><button class="danger-outline-btn" data-act="delete-assignment" data-id="${E(a.id)}">Excluir atividade</button></div></div></article>${cls.assignmentId === a.id ? subsHTML : ""}`).join("") : `<div class="class-empty"><div class="class-empty-icon">📚</div><h3>Nenhuma atividade publicada</h3><p>Use o botão acima para criar a primeira atividade.</p></div>`}</div>`;
}

const val = (id) => $id(id)?.value.trim() || "";
const warn = (m) => showToast(m, "warning", "Atenção");
async function done(error, ok) {
  if (error) showToast(error.message || "Falha na operação.", "error", "Erro");
  else showToast(ok);
  await loadClasses();
}

const classActions = {
  async "reload"() { await loadClasses(); },
  async "new-subject"() {
    const name = val("subject-name"); if (!name) return warn("Digite o nome da disciplina.");
    const { error } = await sb.from("subjects").insert({ teacher_id: currentUser.id, name });
    await done(error, "Disciplina criada.");
  },
  async "new-class"(b) {
    const name = val(`class-name-${b.dataset.id}`); if (!name) return warn("Digite o nome da turma.");
    const { error } = await sb.from("classes").insert({ subject_id: b.dataset.id, teacher_id: currentUser.id, name });
    await done(error, "Turma criada.");
  },
  async "open-class"(b) { cls.classId = b.dataset.id; cls.assignmentId = null; await loadClasses(); },
  async back() { cls.classId = null; cls.assignmentId = null; await loadClasses(); },
  async "add-students"() {
    const list = [...new Set(val("student-emails").split(/[\s,;]+/).filter((e) => e.includes("@")))];
    if (!list.length) return warn("Informe ao menos um e-mail válido.");
    const res = await Promise.all(list.map((e) => sb.rpc("add_student", { c: cls.classId, student_email: e })));
    const fail = res.filter((r) => r.error).length;
    showToast(`${list.length - fail} aluno(s) adicionado(s).${fail ? ` ${fail} falharam.` : ""}`, fail ? "warning" : "success");
    await loadClasses();
  },
  async "new-assignment"() {
    const title = val("as-title"); if (!title) return warn("Digite o título da atividade.");
    const { error } = await sb.from("assignments").insert({ class_id: cls.classId, title, description: val("as-desc"), due_date: val("as-date") || null });
    await done(error, "Atividade publicada.");
  },
  async "delete-assignment"(b) {
    const assignment = (await sb.from("assignments").select("id,title").eq("id", b.dataset.id).maybeSingle()).data;
    if (!assignment) return warn("Essa atividade não foi encontrada.");
    const ok = confirm(`Excluir a atividade "${assignment.title}"?\n\nAs entregas e análises dessa atividade também serão removidas. Essa ação não pode ser desfeita.`);
    if (!ok) return;
    const { error } = await sb.from("assignments").delete().eq("id", b.dataset.id);
    if (!error && cls.assignmentId === b.dataset.id) cls.assignmentId = null;
    await done(error, "Atividade excluída.");
  },
  async "remove-student"(b) {
    const email = b.dataset.id;
    const ok = confirm(`Remover ${email} desta turma?${b.title === "Cancelar convite" ? "\n\nO convite pendente será cancelado." : ""}`);
    if (!ok) return;
    const { error } = await sb.from("class_members").delete().eq("class_id", cls.classId).eq("email", email);
    await done(error, b.title === "Cancelar convite" ? "Convite cancelado." : "Aluno removido da turma.");
  },
  async "open-assignment"(b) {
    cls.assignmentId = cls.assignmentId === b.dataset.id ? null : b.dataset.id; await loadClasses();
  },
  async analyze() {
    const { error } = await sb.functions.invoke("analyze-submission", { body: { assignment_id: cls.assignmentId } });
    await done(error, error ? "" : "Análise concluída.");
  },
  async submit(b) {
    const id = b.dataset.id, content = val(`sub-${id}`);
    if (content.length < 20) return warn("Escreva uma resposta com pelo menos 20 caracteres.");
    const { error } = b.dataset.has === "1"
      ? await sb.from("submissions").update({ content }).eq("assignment_id", id).eq("student_id", currentUser.id)
      : await sb.from("submissions").insert({ assignment_id: id, student_id: currentUser.id, content });
    await done(error, "Resposta enviada com sucesso.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  $id("classes-root")?.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    b.disabled = true;
    try { await classActions[b.dataset.act]?.(b); } finally { b.disabled = false; }
  });
});

window.loadClasses = loadClasses;
