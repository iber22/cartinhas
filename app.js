// ============================================================
// 1) CONFIGURAÇÃO — troque pelos dados do SEU projeto Supabase
// (Painel do Supabase > Project Settings > API)
// ============================================================
const SUPABASE_URL = "https://dtxjpmfkhpkffipafhmh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_meFoU1eoDCYfqD9QAaoU0g_lBHf49Nv";

// As duas únicas contas que podem usar o site.
// Crie esses dois usuários em: Authentication > Users > Add user.
const CONTAS = {
  "pedro@carta.com": "você",
  "luisa@carta.com": "ela"
};

// ============================================================
// 2) Supabase (via CDN, cliente oficial)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 3) Elementos da página
// ============================================================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginErro = document.getElementById("login-erro");
const saudacao = document.getElementById("saudacao");
const btnLogout = document.getElementById("btn-logout");

const menuView = document.getElementById("menu-view");
const writeView = document.getElementById("write-view");
const lettersView = document.getElementById("letters-view");

const btnEscrever = document.getElementById("btn-escrever");
const btnMinhas = document.getElementById("btn-minhas");
const botoesVoltar = document.querySelectorAll("[data-voltar]");

const writeForm = document.getElementById("write-form");
const writeTitulo = document.getElementById("write-titulo");
const writeTexto = document.getElementById("write-texto");
const writeConfirmacao = document.getElementById("write-confirmacao");

const lettersLista = document.getElementById("letters-lista");
const lettersVazio = document.getElementById("letters-vazio");

let canalTempoReal = null;

// ============================================================
// 4) Navegação entre telas
// ============================================================
function mostrarTela(tela) {
  [menuView, writeView, lettersView].forEach(v => v.hidden = true);
  tela.hidden = false;
}

btnEscrever.addEventListener("click", () => mostrarTela(writeView));
btnMinhas.addEventListener("click", () => mostrarTela(lettersView));
botoesVoltar.forEach(b => b.addEventListener("click", () => mostrarTela(menuView)));

// ============================================================
// 5) Login / logout
// ============================================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErro.hidden = true;
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    loginErro.textContent = "e-mail ou senha incorretos.";
    loginErro.hidden = false;
  }
});

btnLogout.addEventListener("click", () => supabase.auth.signOut());

supabase.auth.onAuthStateChange((_evento, session) => {
  if (canalTempoReal) { supabase.removeChannel(canalTempoReal); canalTempoReal = null; }

  const user = session?.user ?? null;
  if (user) {
    loginView.hidden = true;
    appView.hidden = false;
    saudacao.textContent = `oi, ${apelidoDe(user.email)}`;
    mostrarTela(menuView);
    iniciarEscutaDeCartas(user.email);
  } else {
    appView.hidden = true;
    loginView.hidden = false;
    loginForm.reset();
  }
});

function apelidoDe(email) {
  return CONTAS[email] || email;
}

function destinatarioPara(email) {
  const outro = Object.keys(CONTAS).find(e => e !== email);
  return outro || null;
}

// ============================================================
// 6) Escrever cartinha
// ============================================================
writeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  const para = destinatarioPara(user.email);
  if (!para) return;

  const { error } = await supabase.from("cartinhas").insert({
    de: user.email,
    para,
    titulo: writeTitulo.value.trim() || null,
    texto: writeTexto.value.trim(),
    lida: false
  });

  if (error) {
    alert("não deu pra enviar a cartinha agora. tenta de novo em instantinho.");
    return;
  }

  writeForm.reset();
  writeConfirmacao.hidden = false;
  setTimeout(() => { writeConfirmacao.hidden = true; mostrarTela(menuView); }, 1400);
});

// ============================================================
// 7) Minhas cartinhas (as que eu recebi)
// ============================================================
async function iniciarEscutaDeCartas(meuEmail) {
  await carregarCartas(meuEmail);

  // Atualiza a lista em tempo real quando uma cartinha nova chega
  // ou quando o status de "lida" muda em outro dispositivo.
  canalTempoReal = supabase
    .channel("cartinhas-recebidas")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cartinhas", filter: `para=eq.${meuEmail}` },
      () => carregarCartas(meuEmail)
    )
    .subscribe();
}

async function carregarCartas(meuEmail) {
  const { data, error } = await supabase
    .from("cartinhas")
    .select("*")
    .eq("para", meuEmail)
    .order("created_at", { ascending: false });

  if (error) return;

  lettersLista.innerHTML = "";
  lettersVazio.hidden = data.length > 0;
  data.forEach(carta => lettersLista.appendChild(criarCartaElemento(carta)));
}

function criarCartaElemento(carta) {
  const el = document.createElement("article");
  el.className = "carta" + (carta.lida ? "" : " carta-nao-lida");

  const dataTexto = new Date(carta.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric"
  });

  el.innerHTML = `
    <div class="carta-cabecalho">
      <span class="carta-titulo">${escapeHTML(carta.titulo || "sem título")}</span>
      <span class="carta-data">${dataTexto}</span>
    </div>
    <div class="carta-texto">${escapeHTML(carta.texto)}</div>
  `;

  el.addEventListener("click", async () => {
    el.classList.toggle("aberta");
    if (!carta.lida) {
      carta.lida = true;
      el.classList.remove("carta-nao-lida");
      await supabase.from("cartinhas").update({ lida: true }).eq("id", carta.id);
    }
  });

  return el;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
