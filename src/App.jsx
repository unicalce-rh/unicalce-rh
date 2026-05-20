import { useState, useEffect, useRef } from "react";

const NAVY = "#0a2540";
const ORANGE = "#e8660a";
const ORANGE_LIGHT = "#fff4ed";
const NAVY_LIGHT = "#e8edf3";
const CIDADES = ["Capão da Canoa", "Tramandaí"];
const AREAS = ["Vendedor(a)", "Caixa / Operador(a) Financeiro(a)", "Outro"];

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY;

const STATUS_LIST = [
  { key: "recebido", label: "Currículo Recebido", color: "#6b7280", bg: "#f3f4f6" },
  { key: "analise", label: "Em Análise", color: "#1d4ed8", bg: "#eff6ff" },
  { key: "questionario_enviado", label: "Questionário Enviado", color: "#7c3aed", bg: "#f5f3ff" },
  { key: "resposta_recebida", label: "Resposta Recebida", color: "#0891b2", bg: "#ecfeff" },
  { key: "entrevista_agendada", label: "Entrevista Agendada", color: "#d97706", bg: "#fffbeb" },
  { key: "aprovado", label: "Aprovado", color: "#16a34a", bg: "#f0fdf4" },
  { key: "reprovado", label: "Reprovado", color: "#dc2626", bg: "#fef2f2" },
  { key: "contratado", label: "Contratado / Onboarding", color: "#0a2540", bg: "#e8edf3" },
  { key: "em_atividade", label: "Já em Atividade", color: "#065f46", bg: "#ecfdf5" },
  { key: "banco_talentos", label: "Banco de Talentos", color: "#9333ea", bg: "#faf5ff" },
  { key: "pausado", label: "Processo Pausado", color: "#92400e", bg: "#fef3c7" },
];

const getStatus = (key) => STATUS_LIST.find(s => s.key === key) || STATUS_LIST[0];
const Badge = ({ statusKey }) => {
  const s = getStatus(statusKey);
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{s.label}</span>;
};

const inp = { width: "100%", padding: "9px 13px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", background: "#fff", color: NAVY, boxSizing: "border-box", fontFamily: "system-ui,sans-serif" };
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 };

const supaFetch = async (path, method = "GET", body = null) => {
  const opts = {
    method,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
};

export default function App() {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("lista");
  const [selected, setSelected] = useState(null);
  const [filtros, setFiltros] = useState({ status: "", cargo: "", cidade: "" });
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cargo: "", cidade: "", status: "recebido", obs: "" });
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState(null);
  const pollRef = useRef(null);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const loadData = async (silent = false) => {
    try {
      const data = await supaFetch("candidatos?order=id.asc");
      setCandidatos(data.map(c => ({ ...c, respostas: c.respostas ? JSON.parse(c.respostas) : [] })));
      if (!silent) showToast(`${data.length} candidato(s) carregado(s)!`, "ok");
    } catch (e) {
      if (!silent) showToast("Erro ao carregar: " + e.message, "err");
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData().then(() => setLoading(false));
    pollRef.current = setInterval(() => loadData(true), 20000);
    return () => clearInterval(pollRef.current);
  }, []);

  const filtrados = candidatos.filter(c =>
    (!filtros.status || c.status === filtros.status) &&
    (!filtros.cargo || c.cargo === filtros.cargo) &&
    (!filtros.cidade || c.cidade === filtros.cidade)
  );

  const openForm = (cand = null) => {
    if (cand) { setForm({ ...cand }); setEditMode(true); }
    else { setForm({ nome: "", email: "", telefone: "", cargo: "", cidade: "", status: "recebido", obs: "" }); setEditMode(false); }
    setView("form");
  };

  const salvar = async () => {
    if (!form.nome || !form.email || !form.cargo || !form.cidade) { alert("Preencha nome, e-mail, cargo e cidade."); return; }
    setSaving(true);
    try {
      const payload = { nome: form.nome, email: form.email, telefone: form.telefone, cargo: form.cargo, cidade: form.cidade, status: form.status, obs: form.obs };
      if (editMode) {
        await supaFetch(`candidatos?id=eq.${form.id}`, "PATCH", payload);
        showToast("Candidato atualizado!");
        setView("detalhe");
      } else {
        await supaFetch("candidatos", "POST", payload);
        showToast("Candidato cadastrado!");
        setView("lista");
      }
      await loadData(true);
    } catch (e) { showToast("Erro ao salvar: " + e.message, "err"); }
    setSaving(false);
  };

  const excluir = async (id) => {
    if (!window.confirm("Remover este candidato?")) return;
    try {
      await supaFetch(`candidatos?id=eq.${id}`, "DELETE");
      setCandidatos(prev => prev.filter(c => c.id !== id));
      showToast("Candidato removido.");
      setView("lista");
    } catch (e) { showToast("Erro ao remover: " + e.message, "err"); }
  };

  const atualizarStatus = async (id, novoStatus) => {
    try {
      await supaFetch(`candidatos?id=eq.${id}`, "PATCH", { status: novoStatus });
      setCandidatos(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
      if (selected?.id === id) setSelected(p => ({ ...p, status: novoStatus }));
      showToast("Status atualizado!");
    } catch (e) { showToast("Erro: " + e.message, "err"); }
  };

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", minHeight: "100vh", background: "#f8fafc", color: NAVY }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: toast.type === "err" ? "#fef2f2" : "#f0fdf4", color: toast.type === "err" ? "#dc2626" : "#16a34a", border: `1px solid ${toast.type === "err" ? "#fca5a5" : "#bbf7d0"}`, borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 500, animation: "fadein 0.2s ease", boxShadow: "0 4px 12px #0002" }}>{toast.msg}</div>}

      <div style={{ background: NAVY, padding: "0 24px", display: "flex", alignItems: "center", gap: 14, height: 56 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>U</span>
        </div>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Unicalce Fenícia Calçados</span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>— Painel de Recrutamento</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {saving && <span style={{ color: "#94a3b8", fontSize: 12 }}>Salvando...</span>}
          <button onClick={() => loadData()} style={{ background: "transparent", border: "1px solid #ffffff44", color: "#fff", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>⟳ Sincronizar</button>
          {view !== "lista" && <button onClick={() => setView("lista")} style={{ background: "transparent", border: "1px solid #ffffff44", color: "#fff", borderRadius: 8, padding: "5px 14px", cursor: "pointer", fontSize: 13 }}>← Voltar</button>}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 14 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${NAVY_LIGHT}`, borderTop: `3px solid ${ORANGE}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "#6b7280", fontSize: 14 }}>Carregando dados...</span>
          </div>
        ) : view === "lista" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total", val: candidatos.length, color: NAVY },
                { label: "Em Análise", val: candidatos.filter(c => c.status === "analise").length, color: "#1d4ed8" },
                { label: "Entrevistas", val: candidatos.filter(c => c.status === "entrevista_agendada").length, color: ORANGE },
                { label: "Aprovados", val: candidatos.filter(c => ["aprovado","contratado","em_atividade"].includes(c.status)).length, color: "#16a34a" },
              ].map(m => (
                <div key={m.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 600, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))} style={{ ...inp, width: "auto", flex: 1, minWidth: 160 }}>
                <option value="">Todos os status</option>
                {STATUS_LIST.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={filtros.cargo} onChange={e => setFiltros(f => ({ ...f, cargo: e.target.value }))} style={{ ...inp, width: "auto", flex: 1, minWidth: 140 }}>
                <option value="">Todas as áreas</option>
                {AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
              <select value={filtros.cidade} onChange={e => setFiltros(f => ({ ...f, cidade: e.target.value }))} style={{ ...inp, width: "auto", flex: 1, minWidth: 140 }}>
                <option value="">Todas as cidades</option>
                {CIDADES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={() => openForm()} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>+ Novo Candidato</button>
            </div>
            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>Nenhum candidato encontrado.</div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: NAVY_LIGHT }}>
                      {["Nome","Cargo","Cidade","Status",""].map((h, i) => (
                        <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, width: ["30%","20%","16%","24%","10%"][i] }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{c.nome}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{c.email}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{c.cargo}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{c.cidade}</td>
                        <td style={{ padding: "10px 14px" }}><Badge statusKey={c.status} /></td>
                        <td style={{ padding: "10px 14px" }}>
                          <button onClick={() => { setSelected(c); setView("detalhe"); }} style={{ background: "transparent", border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Ver</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : view === "form" ? (
          <div style={{ ...card, maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{editMode ? "Editar Candidato" : "Novo Candidato"}</h2>
            {[{ label: "Nome completo *", field: "nome", type: "text" }, { label: "E-mail *", field: "email", type: "email" }, { label: "Telefone", field: "telefone", type: "text" }].map(({ label, field, type }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
                <input type={type} value={form[field] || ""} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 4 }}>Cargo *</label>
                <select value={form.cargo || ""} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} style={inp}><option value="">Selecione</option>{AREAS.map(a => <option key={a}>{a}</option>)}</select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 4 }}>Cidade *</label>
                <select value={form.cidade || ""} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} style={inp}><option value="">Selecione</option>{CIDADES.map(c => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 4 }}>Status</label>
              <select value={form.status || "recebido"} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>{STATUS_LIST.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 4 }}>Observações</label>
              <textarea value={form.obs || ""} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={salvar} disabled={saving} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? "Salvando..." : editMode ? "Salvar alterações" : "Cadastrar"}</button>
              <button onClick={() => setView(editMode ? "detalhe" : "lista")} style={{ background: "transparent", border: "1px solid #d1d5db", color: "#374151", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </div>
        ) : view === "detalhe" && selected && (() => {
          const cand = candidatos.find(c => c.id === selected.id) || selected;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div><h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>{cand.nome}</h2><div style={{ fontSize: 13, color: "#6b7280" }}>{cand.cargo} — {cand.cidade}</div></div>
                  <Badge statusKey={cand.status} />
                </div>
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
                  {[{ label: "E-mail", val: cand.email }, { label: "Telefone", val: cand.telefone || "—" }, { label: "Área", val: cand.cargo }, { label: "Cidade", val: cand.cidade }, { label: "Data envio", val: cand.data_envio || "—" }].map(({ label, val }) => (
                    <div key={label}><div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 14 }}>{val}</div></div>
                  ))}
                </div>
                {cand.respostas?.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 16 }}>Respostas do Questionário</div>
                    {(() => {
                      const blocos = [...new Set(cand.respostas.map(r => r.bloco))];
                      return blocos.map(bloco => (
                        <div key={bloco} style={{ marginBottom: 20 }}>
                          <div style={{ display: "inline-block", background: ORANGE_LIGHT, color: ORANGE, border: `1px solid ${ORANGE}44`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{bloco}</div>
                          {cand.respostas.filter(r => r.bloco === bloco).map((r, i) => (
                            <div key={i} style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 4 }}>{r.pergunta}</div>
                              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65, background: "#f9fafb", borderRadius: 8, padding: "10px 12px", border: "1px solid #f3f4f6" }}>{r.resposta || "—"}</div>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                )}
                {cand.obs && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Observações</div>
                    <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{cand.obs}</p>
                  </div>
                )}
                <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                  <button onClick={() => openForm(cand)} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                  <button onClick={() => excluir(cand.id)} style={{ background: "transparent", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Remover</button>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Atualizar status</div>
                {STATUS_LIST.map(s => (
                  <button key={s.key} onClick={() => atualizarStatus(cand.id, s.key)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", marginBottom: 6, borderRadius: 8, border: cand.status === s.key ? `2px solid ${ORANGE}` : "1px solid #e5e7eb", background: cand.status === s.key ? ORANGE_LIGHT : "#fafafa", color: cand.status === s.key ? ORANGE : "#374151", cursor: "pointer", fontSize: 13, fontWeight: cand.status === s.key ? 600 : 400 }}>{s.label}</button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
