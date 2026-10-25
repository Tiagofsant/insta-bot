/*
 * Insta Unfollow - interface visual para deixar de seguir contas em massa, escolhendo quem sai.
 *
 * Como usar (resumo; veja LEIA-ME.md):
 *   1. Abra https://www.instagram.com no navegador do computador, já logado.
 *   2. Abra o Console (F12 > Console), cole este arquivo inteiro e aperte Enter.
 *   3. Clique em "Carregar quem eu sigo", clique nos cartões de quem vai sair e em "Começar a remover".
 *
 * O script roda só no seu navegador, usando a sessão já aberta do Instagram.
 * Não pede, não guarda e não envia sua senha para lugar nenhum.
 */
(function boot() {
  'use strict';

  if (!document.body) {
    document.addEventListener('DOMContentLoaded', boot);
    return;
  }

  if (window.__instaUnfollow) {
    window.__instaUnfollow.show();
    return;
  }

  const DEMO = !!window.__IGUF_DEMO__;
  const ON_IG = /(^|\.)instagram\.com$/.test(location.hostname);
  if (!DEMO && !ON_IG) {
    alert('Abra https://www.instagram.com (logado) e cole o script no console dessa aba.');
    return;
  }

  // ---------- utilitários ----------
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const today = () => new Date().toISOString().slice(0, 10);
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* armazenamento cheio ou bloqueado: segue sem salvar */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* ignora */
      }
    },
  };
  const fmtDur = (sec) => {
    sec = Math.max(0, Math.round(sec));
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.round((sec % 3600) / 60);
      return h + ' h' + (m ? ' ' + m + ' min' : '');
    }
    if (sec >= 60) return Math.round(sec / 60) + ' min';
    return sec + ' s';
  };
  const fmtClock = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  const hashHue = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  };
  const initials = (u) => {
    const base = (u.full_name || u.username || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    const parts = base.split(/\s+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };

  // elemento DOM sem innerHTML para dados vindos de fora
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // só para ícones estáticos deste arquivo
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }

  const ICON = {
    shield: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/></svg>',
    shieldOn: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/></svg>',
    store: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v10h16V10M3 4h18l-1 6H4z"/></svg>',
    person: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    badge: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2l2.4 2.1 3.2-.3.7 3.1 2.8 1.6-1.3 2.9 1.3 2.9-2.8 1.6-.7 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.7-3.1-2.8-1.6 1.3-2.9-1.3-2.9 2.8-1.6.7-3.1 3.2.3z"/><path d="M8 12.2l2.6 2.6L16 9.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    min: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  };

  // ---------- dados da demonstração ----------
  function demoAccounts() {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const first = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Thiago', 'Vitória', 'Lucas', 'Camila', 'Pedro', 'Juliana', 'Mateus', 'Beatriz', 'Gustavo', 'Letícia', 'André', 'Renata', 'Caio'];
    const last = ['Silva', 'Souza', 'Oliveira', 'Lima', 'Pereira', 'Costa', 'Rocha', 'Almeida', 'Barbosa', 'Ribeiro', 'Martins', 'Carvalho', 'Teixeira', 'Moreira', 'Freitas', 'Mendes', 'Nunes', 'Cardoso'];
    const bizA = ['cafe', 'padaria', 'studio', 'brecho', 'oficina', 'atelie', 'barbearia', 'livraria', 'horta', 'pizzaria', 'sorveteria', 'academia', 'floricultura', 'pet'];
    const bizB = ['dobairro', 'vilamariana', 'centro', 'praia', 'serra', 'aurora', 'jardim', 'saojorge', 'boavista', 'primavera', 'norte', 'luar'];
    const memes = ['memes', 'receitas', 'viagens', 'frases', 'fitness', 'humor', 'dicas', 'promo', 'sorteios', 'motivacao'];
    const out = [];
    const used = new Set();
    for (let i = 0; out.length < 264; i++) {
      const r = rnd();
      let username;
      let full;
      if (r < 0.62) {
        const f = pick(first);
        const l = pick(last);
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const style = Math.floor(rnd() * 4);
        username = [norm(f) + '.' + norm(l), norm(f) + '_' + norm(l), norm(f) + norm(l) + Math.floor(rnd() * 99), norm(f) + '.' + norm(l)[0] + Math.floor(rnd() * 9)][style];
        full = f + ' ' + l;
      } else if (r < 0.85) {
        const a = pick(bizA);
        const b = pick(bizB);
        username = a + '.' + b;
        full = a.charAt(0).toUpperCase() + a.slice(1) + ' ' + b.charAt(0).toUpperCase() + b.slice(1);
      } else {
        const m = pick(memes);
        username = m + (rnd() < 0.5 ? '_br' : '.oficial') + (rnd() < 0.4 ? Math.floor(rnd() * 999) : '');
        full = rnd() < 0.5 ? '' : m.charAt(0).toUpperCase() + m.slice(1) + ' do Dia';
      }
      if (used.has(username)) continue;
      used.add(username);
      const isMeme = r >= 0.85;
      out.push({
        pk: String(900000 + i),
        username,
        full_name: full,
        is_verified: rnd() < 0.04,
        is_private: r < 0.62 && rnd() < 0.35,
        profile_pic_url: '',
        _isBusiness: r >= 0.62,
        _followsBack: isMeme ? rnd() < 0.05 : r < 0.62 ? rnd() < 0.7 : rnd() < 0.25,
      });
    }
    return out;
  }

  // ---------- acesso ao Instagram ----------
  class IgError extends Error {
    constructor(message, kind) {
      super(message);
      this.kind = kind; // 'rate' | 'blocked' | 'auth' | 'other'
    }
  }

  function realApi(myId) {
    const headers = () => {
      const hd = {
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest',
        'x-csrftoken': getCookie('csrftoken') || '',
      };
      const claim = sessionStorage.getItem('www-claim-v2');
      if (claim) hd['x-ig-www-claim'] = claim;
      return hd;
    };

    async function igFetch(url, opts = {}) {
      const res = await fetch(url, {
        credentials: 'include',
        ...opts,
        headers: { ...headers(), ...(opts.headers || {}) },
      });
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        /* resposta sem JSON */
      }
      if (res.status === 429) throw new IgError('Muitas requisições (429).', 'rate');
      if (res.status === 401 || res.status === 403 || (body && body.message === 'login_required')) {
        throw new IgError('Sessão expirada ou sem permissão. Recarregue a página e faça login.', 'auth');
      }
      if (body && (body.spam || body.message === 'feedback_required' || body.feedback_title)) {
        throw new IgError(
          'O Instagram bloqueou a ação temporariamente' + (body.feedback_message ? ': ' + body.feedback_message : '.'),
          'blocked'
        );
      }
      if (!res.ok || !body || body.status === 'fail') {
        throw new IgError('Erro ' + res.status + (body && body.message ? ': ' + body.message : ''), 'other');
      }
      return body;
    }

    const UNFOLLOW_DOC_ID = '27789106940691111';
    const UNFOLLOW_FRIENDLY_NAME = 'usePolarisUnfollowMutation';
    let tokenCache = null;

    // fb_dtsg e lsd: chaves que a própria página do Instagram usa nos pedidos GraphQL
    async function webTokens() {
      if (tokenCache) return tokenCache;
      let fbDtsg = null;
      let lsd = null;
      let revision = null;
      try {
        const req = window.require;
        if (typeof req === 'function') {
          fbDtsg = (req('DTSGInitialData') || {}).token || null;
          lsd = (req('LSD') || {}).token || null;
          revision = (req('SiteData') || {}).client_revision || null;
        }
      } catch (e) {
        /* módulo indisponível */
      }
      const fromHtml = (html) => {
        const m1 = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) || html.match(/"dtsg":\{"token":"([^"]+)"/);
        const m2 = html.match(/"LSD",\[\],\{"token":"([^"]+)"/);
        const m3 = html.match(/"client_revision":(\d+)/);
        if (!fbDtsg && m1) fbDtsg = m1[1];
        if (!lsd && m2) lsd = m2[1];
        if (!revision && m3) revision = m3[1];
      };
      if (!fbDtsg || !lsd) fromHtml(document.documentElement.innerHTML);
      if (!fbDtsg || !lsd) {
        const res = await fetch('https://www.instagram.com/', { credentials: 'include' });
        fromHtml(await res.text());
      }
      if (!fbDtsg || !lsd) {
        throw new IgError('Não achei as chaves da sessão na página. Recarregue o instagram.com e cole o script de novo.', 'auth');
      }
      tokenCache = { fbDtsg, lsd, revision };
      return tokenCache;
    }

    function jazoest(token) {
      let sum = 0;
      for (let i = 0; i < token.length; i++) sum += token.charCodeAt(i);
      return '2' + sum;
    }

    function findKey(obj, key, depth = 0) {
      if (!obj || typeof obj !== 'object' || depth > 6) return null;
      if (obj[key] && typeof obj[key] === 'object') return obj[key];
      for (const v of Object.values(obj)) {
        const r = findKey(v, key, depth + 1);
        if (r) return r;
      }
      return null;
    }

    // true = ainda segue, false = não segue mais, null = não deu para saber
    async function stillFollowing(pk, username) {
      try {
        const data = await igFetch(
          'https://www.instagram.com/api/v1/friendships/' + myId + '/following/?count=12&query=' + encodeURIComponent(username || '')
        );
        const name = String(username || '').toLowerCase();
        return (data.users || []).some(
          (u) => String(u.pk_id || u.id || u.pk) === String(pk) || String(u.username || '').toLowerCase() === name
        );
      } catch (e) {
        return null;
      }
    }

    return {
      async list(kind, onProgress, shouldStop) {
        const out = [];
        let maxId = '';
        let page = 0;
        for (;;) {
          if (shouldStop()) break;
          const url =
            'https://www.instagram.com/api/v1/friendships/' + myId + '/' + kind + '/?count=50' +
            (maxId ? '&max_id=' + encodeURIComponent(maxId) : '');
          let data;
          for (let attempt = 1; ; attempt++) {
            try {
              data = await igFetch(url);
              break;
            } catch (e) {
              if (e.kind === 'rate' && attempt <= 3) {
                const wait = 60 * attempt;
                log('O Instagram pediu calma. Esperando ' + wait + ' s antes de continuar a lista.', 'warn');
                await sleep(wait * 1000);
                continue;
              }
              throw e;
            }
          }
          const users = data.users || [];
          out.push(...users);
          page++;
          onProgress(out.length);
          maxId = data.next_max_id;
          if (!maxId || users.length === 0) break;
          await sleep(rand(1200, 2800) + (page % 10 === 0 ? rand(5000, 10000) : 0));
        }
        return out.map((u) => ({
          pk: String(u.pk_id || u.id || u.pk), // pk_id vem como texto; pk em número pode perder dígitos
          username: u.username,
          full_name: u.full_name || '',
          is_verified: !!u.is_verified,
          is_private: !!u.is_private,
          profile_pic_url: u.profile_pic_url || '',
        }));
      },

      // Desde outubro de 2026 as rotas antigas de unfollow devolvem 404 (ou a página HTML).
      // Agora fazemos o mesmo pedido GraphQL que o botão "Seguindo > Deixar de seguir" do site faz,
      // e só contamos como removida depois de confirmar que a conta saiu da sua lista.
      async unfollow(pk, username) {
        const t = await webTokens();
        const params = {
          av: myId,
          __d: 'www',
          __user: '0',
          __a: '1',
          __comet_req: '7',
          fb_dtsg: t.fbDtsg,
          jazoest: jazoest(t.fbDtsg),
          lsd: t.lsd,
          fb_api_caller_class: 'RelayModern',
          fb_api_req_friendly_name: UNFOLLOW_FRIENDLY_NAME,
          variables: JSON.stringify({
            target_user_id: String(pk),
            container_module: 'profile',
            nav_chain: 'PolarisProfilePostsTabRoot:profilePage:1:via_cold_start',
          }),
          server_timestamps: 'true',
          doc_id: UNFOLLOW_DOC_ID,
        };
        if (t.revision) params.__rev = params.__spin_r = t.revision;
        const res = await fetch('https://www.instagram.com/api/graphql', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'x-csrftoken': getCookie('csrftoken') || '',
            'x-fb-friendly-name': UNFOLLOW_FRIENDLY_NAME,
            'x-fb-lsd': t.lsd,
            'x-ig-app-id': '936619743392459',
            'x-asbd-id': '359341',
          },
          body: new URLSearchParams(params).toString(),
        });
        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text.replace(/^for \(;;\);/, ''));
        } catch (e) {
          /* não é JSON */
        }
        const errText = data ? JSON.stringify(data.errors || data.error || data.message || '') : '';
        if (res.status === 429 || (data && data.spam) || /rate limit|checkpoint|feedback_required|try again later/i.test(errText)) {
          throw new IgError('O Instagram bloqueou a ação temporariamente.', 'blocked');
        }
        if (res.status === 401 || res.status === 403 || /login_required/.test(errText)) {
          tokenCache = null;
          throw new IgError('Sessão expirada ou sem permissão. Recarregue a página e faça login.', 'auth');
        }
        if (!res.ok || !data || data.errors || data.error || !data.data) {
          tokenCache = null;
          throw new IgError(
            'o Instagram recusou o pedido, HTTP ' + res.status + (errText ? ': ' + errText.slice(0, 160) : data ? '' : ', resposta não é JSON'),
            'other'
          );
        }
        const fs = findKey(data.data, 'friendship_status');
        if (fs && (fs.following === true || fs.outgoing_request === true)) {
          throw new IgError('o Instagram respondeu, mas a conta continua seguida', 'other');
        }
        // confere na sua lista de seguindo
        const still = await stillFollowing(pk, username);
        if (still === true) throw new IgError('o Instagram respondeu, mas a conta continua na sua lista', 'other');
        if (still === null && !(fs && fs.following === false)) throw new IgError('não consegui confirmar a remoção', 'other');
      },

      // dados públicos do perfil: diz se é conta comercial (empresa/marca) e a categoria
      async profileType(username) {
        const data = await igFetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username));
        const u = (data.data && data.data.user) || {};
        const category = u.business_category_name || u.category_name || u.overall_category_name || '';
        return { kind: u.is_business_account ? 'pagina' : 'pessoa', category };
      },
    };
  }

  function demoApi() {
    const all = demoAccounts();
    return {
      async list(kind, onProgress, shouldStop) {
        const src = kind === 'following' ? all : all.filter((u) => u._followsBack);
        const out = [];
        for (let i = 0; i < src.length; i += 50) {
          if (shouldStop()) break;
          await sleep(350);
          out.push(...src.slice(i, i + 50));
          onProgress(out.length);
        }
        return out.map(({ _followsBack, _isBusiness, ...u }) => u);
      },
      async unfollow() {
        await sleep(450);
      },
      async profileType(username) {
        await sleep(250);
        const u = all.find((x) => x.username === username);
        if (!u) throw new IgError('Perfil não encontrado.', 'other');
        return u._isBusiness
          ? { kind: 'pagina', category: u.username.startsWith('memes') || u.username.match(/^(receitas|viagens|frases|fitness|humor|dicas|promo|sorteios|motivacao)/) ? 'Entretenimento' : 'Empresa local' }
          : { kind: 'pessoa', category: '' };
      },
      seed: all,
    };
  }

  const myId = DEMO ? 'demo' : getCookie('ds_user_id');
  if (!myId) {
    alert('Não encontrei sua sessão. Faça login no instagram.com e tente de novo.');
    return;
  }
  const api = DEMO ? demoApi() : realApi(myId);
  const TIME_SCALE = DEMO ? 1 / 25 : 1; // na demonstração o tempo corre 25x mais rápido

  // ---------- estado ----------
  const K = {
    users: 'iguf_users_' + myId,
    followers: 'iguf_followers_' + myId,
    selected: 'iguf_selected_' + myId,
    done: 'iguf_done_' + myId,
    daily: 'iguf_daily_' + myId,
    cfg: 'iguf_cfg' + (DEMO ? '_demo' : ''),
    view: 'iguf_view' + (DEMO ? '_demo' : ''),
    vault: 'iguf_vault_' + myId,
    kinds: 'iguf_kinds_' + myId,
  };

  const PRESETS = {
    cauteloso: { delayMin: 60, delayMax: 120, batchSize: 8, batchPauseMin: 10, batchPauseMax: 20, dailyLimit: 60 },
    normal: { delayMin: 40, delayMax: 90, batchSize: 10, batchPauseMin: 5, batchPauseMax: 10, dailyLimit: 150 },
  };
  const DEFAULT_CFG = Object.assign({ preset: 'normal', dryRun: false }, PRESETS.normal);

  const state = {
    users: [], // na ordem do Instagram (mais recentes primeiro)
    byPk: new Map(),
    followers: new Set(store.get(K.followers, []).map(String)),
    followersLoaded: store.get(K.followers, null) !== null,
    selected: new Set(store.get(K.selected, []).map(String)),
    done: new Set(store.get(K.done, []).map(String)),
    cfg: Object.assign({}, DEFAULT_CFG, store.get(K.cfg, {})),
    view: Object.assign({ filter: 'all', sort: 'recent' }, store.get(K.view, {})),
    query: '',
    loading: null, // { kind, count }
    run: null, // { total, done, current, phase, until, phaseLen }
    stopRequested: false,
    lastClicked: null,
    renderLimit: 0,
    visible: [],
    vault: new Map(store.get(K.vault, []).map((v) => [String(v.pk), Object.assign({}, v, { pk: String(v.pk) })])),
    kinds: store.get(K.kinds, {}), // pk -> { kind, category, source: 'perfil' | 'voce' }
    checking: null, // { total, done }
  };

  function setUsers(list) {
    state.users = list.map((u, i) => Object.assign({}, u, { pk: String(u.pk), order: i }));
    state.byPk = new Map(state.users.map((u) => [u.pk, u]));
  }
  setUsers(store.get(K.users, []));

  const demoFresh = DEMO && state.users.length === 0;
  if (demoFresh) {
    // a demonstração já abre com a lista carregada e alguns marcados
    setUsers(api.seed.map(({ _followsBack, _isBusiness, ...u }) => u));
    state.followers = new Set(api.seed.filter((u) => u._followsBack).map((u) => u.pk));
    state.followersLoaded = true;
    api.seed.filter((u) => !u._followsBack).slice(0, 6).forEach((u) => state.selected.add(u.pk));
    store.set(K.users, state.users);
    store.set(K.followers, [...state.followers]);
    store.set(K.selected, [...state.selected]);
  }

  const daily = () => {
    const d = store.get(K.daily, null);
    return d && d.date === today() ? d : { date: today(), count: 0 };
  };
  const bumpDaily = () => {
    const d = daily();
    d.count += 1;
    store.set(K.daily, d);
    return d.count;
  };
  const saveSelected = () => store.set(K.selected, [...state.selected]);
  const saveDone = () => store.set(K.done, [...state.done]);
  const saveCfg = () => store.set(K.cfg, state.cfg);
  const saveView = () => store.set(K.view, state.view);
  const isDone = (u) => state.done.has(u.pk);
  const lower = (s) => String(s || '').toLowerCase();
  let vaultNames = new Set();
  const inVault = (u) => state.vault.has(u.pk) || vaultNames.has(lower(u.username));
  const queue = () => state.users.filter((u) => state.selected.has(u.pk) && !isDone(u) && !inVault(u));
  function saveVault() {
    vaultNames = new Set([...state.vault.values()].map((v) => lower(v.username)));
    store.set(K.vault, [...state.vault.values()]);
  }
  // entradas importadas antes de carregar a lista ganham o id real quando a conta aparece
  function reconcileVault() {
    const byName = new Map(state.users.map((u) => [lower(u.username), u]));
    for (const [pk, v] of [...state.vault]) {
      const live = byName.get(lower(v.username));
      if (live && live.pk !== pk) {
        state.vault.delete(pk);
        state.vault.set(live.pk, Object.assign({}, v, { pk: live.pk }));
      }
    }
    saveVault();
  }
  const saveKinds = () => store.set(K.kinds, state.kinds);

  // ---------- pessoa ou página? ----------
  // Primeiro um palpite pelo @ e pelo nome; "Conferir tipo" pergunta ao Instagram se a conta é comercial;
  // e um clique na etiqueta deixa você corrigir na mão. A correção manual sempre vence.
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const PAGE_WORDS = new Set(('loja store shop oficial official studio estudio cafe cafeteria restaurante bar pizzaria padaria ' +
    'burger hamburgueria lanchonete doceria confeitaria sorveteria acai academia fitness crossfit clinica odonto odontologia ' +
    'estetica salao barbearia beauty makeup moda fashion boutique imoveis imobiliaria corretora news noticias jornal tv radio ' +
    'revista magazine blog memes meme humor frases receitas dicas promo promocoes sorteio sorteios oficina atelie brecho ' +
    'livraria editora pet petshop floricultura delivery tattoo fotografia photography eventos buffet turismo viagens hotel ' +
    'pousada igreja ministerio escola curso cursos colegio universidade faculdade banco seguros marketing agencia digital games ' +
    'futebol clube club banda music musica records festival prefeitura governo shopping mercado supermercado farmacia ong ' +
    'instituto fundacao company ltda grupo group brand marca app motivacao entretenimento podcast canal distribuidora ' +
    'atacado varejo moveis decor decoracao arquitetura engenharia advocacia advogados contabilidade consultoria horta ' +
    'hortifruti feira sitio fazenda vinhos cervejaria brewery kitchen food foods sushi churrascaria acougue emporio').split(' '));
  const PAGE_SUFFIX = /(oficial|official|store|shop|loja|_br|\.br|brasil|news|tv|fm|hq|club|app)$/;
  const FIRST_NAMES = new Set(('ana bruno carla diego elisa felipe gabriela gabriel henrique isabela isabel joao jose larissa marcos ' +
    'natalia otavio paula paulo rafael rafaela sofia thiago tiago vitoria victor vitor lucas camila pedro juliana mateus matheus ' +
    'beatriz gustavo leticia andre renata caio maria marcela mariana fernanda fernando carlos eduardo eduarda luiz luis luiza ' +
    'luisa julia amanda bruna daniel daniela rodrigo ricardo roberto patricia aline alice laura leonardo leo gabi vinicius ' +
    'guilherme igor joana jessica jessica karina kelly lais livia lorena manuela miguel murilo nathalia nicolas pamela priscila ' +
    'raquel sabrina samuel sara sarah talita tatiana valeria vanessa yasmin arthur heitor davi bernardo enzo antonio francisco ' +
    'helena valentina cecilia clara isadora lara melissa debora denise sandra simone silvia sergio marcelo marcio mauricio ' +
    'alexandre alex anderson adriana adriano alan alessandra barbara bianca carolina caroline cristina cristiane diana diogo ' +
    'erika fabio fabiana flavia flavio giovana giovanna helio hugo ingrid ivan jean jorge julio kaique lucia luciana marina ' +
    'milena monica nina otto renan renato rita rosa sofia tais thais thomas tomas vera wagner wesley william yuri').split(' '));

  function guessKind(u) {
    const uname = norm(u.username);
    const name = norm(u.full_name);
    const tokens = new Set([...uname.split(/[._\d]+/), ...name.split(/[^a-z0-9]+/)].filter(Boolean));
    for (const t of tokens) if (PAGE_WORDS.has(t)) return 'pagina';
    if (PAGE_SUFFIX.test(uname)) return 'pagina';
    if (/[®™|•@]|\b(ltda|me|eireli|s\.a)\b/i.test(u.full_name || '')) return 'pagina';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length && FIRST_NAMES.has(words[0])) return 'pessoa';
    for (const t of tokens) if (FIRST_NAMES.has(t)) return 'pessoa';
    if (words.length >= 2 && words.length <= 4) return 'pessoa';
    return '?';
  }

  const guessCache = new Map();
  function classify(u) {
    const k = state.kinds[u.pk];
    if (k) return k;
    let g = guessCache.get(u.pk);
    if (!g) guessCache.set(u.pk, (g = { kind: guessKind(u), category: '', source: 'palpite' }));
    return g;
  }

  reconcileVault();
  if (demoFresh) {
    // a demonstração abre com três pessoas já guardadas no cofre
    for (const u of state.users.filter((x) => x.full_name && !/\d/.test(x.username) && classify(x).kind === 'pessoa' && !state.selected.has(x.pk)).slice(0, 3)) {
      state.vault.set(u.pk, { pk: u.pk, username: u.username, full_name: u.full_name, added: today() });
    }
    saveVault();
  }

  // ---------- estilo ----------
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href =
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap';
  document.head.appendChild(fontLink);

  const CSS = `
  /* Layout: mesa de triagem. Cabeçalho com números, grade de cartões à esquerda, fila de remoção à direita. */
  .app{
    --bg:#EEF0F5; --surface:#FFFFFF; --raised:#F7F8FB; --ink:#14161C; --muted:#646B7B; --line:#DADEE8;
    --accent:#2F45D8; --accent-ink:#FFFFFF; --accent-soft:#E4E8FD;
    --cut:#D93A32; --cut-ink:#FFFFFF; --cut-soft:#FCE9E7; --ok:#1C7F4E; --ok-soft:#E2F3EA; --page:#7A3FB8; --page-soft:#F1E8FB; --warn:#9A5B00; --warn-soft:#FBF0DC;
    --shadow:0 1px 2px rgba(20,22,28,.06),0 6px 20px rgba(20,22,28,.06);
    --display:"Bricolage Grotesque",ui-rounded,"Segoe UI",system-ui,sans-serif;
    --body:"Instrument Sans",-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
    color-scheme:light;
  }
  .app.dark{
    --bg:#0D0F14; --surface:#161921; --raised:#1C2029; --ink:#ECEEF4; --muted:#9299A9; --line:#2A2F3B;
    --accent:#8394FF; --accent-ink:#0D0F14; --accent-soft:#232A4D;
    --cut:#FF6A60; --cut-ink:#1A0B0A; --cut-soft:#3A1E1D; --ok:#53C892; --ok-soft:#173226; --page:#C8A2F5; --page-soft:#2E2140; --warn:#F0B451; --warn-soft:#352914;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.25);
    color-scheme:dark;
  }
  *{box-sizing:border-box;margin:0}
  [hidden]{display:none!important}
  .app{position:fixed;inset:0;z-index:2147483647;background:var(--bg);color:var(--ink);font:14px/1.45 var(--body);
    display:flex;flex-direction:column;overflow:hidden;
    padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);-webkit-font-smoothing:antialiased}
  button,input,select{font:inherit;color:inherit}
  button{cursor:pointer}
  button:focus-visible,input:focus-visible,select:focus-visible,.card:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .demo{background:var(--warn-soft);color:var(--warn);padding:7px 20px;font-size:13px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .demo b{font-weight:600}
  .demo button{background:none;border:1px solid currentColor;border-radius:999px;padding:2px 10px;font-size:12px;color:inherit}

  .top{display:flex;align-items:center;gap:16px;padding:14px 20px 10px;flex-wrap:wrap}
  .brand{display:flex;align-items:baseline;gap:10px;margin-right:auto;min-width:0}
  .brand h1{font:700 22px/1.1 var(--display);letter-spacing:-.01em}
  .brand span{color:var(--muted);font-size:13px}
  .actions{display:flex;gap:8px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 12px;font-weight:500;white-space:nowrap}
  .btn:hover:not(:disabled){border-color:var(--muted)}
  .btn:disabled{opacity:.45;cursor:default}
  .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
  .btn.cut{background:var(--cut);border-color:var(--cut);color:var(--cut-ink)}
  .btn.ghost{background:none;border-color:transparent}
  .btn.ghost:hover:not(:disabled){background:var(--raised);border-color:var(--line)}
  .btn.icon{padding:7px}
  .btn.big{padding:12px 18px;font-size:15px;border-radius:12px;width:100%;justify-content:center;font-weight:600}

  .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:0 20px 14px}
  .stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-width:0}
  .stat .lbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
  .stat .num{font:700 30px/1.1 var(--display);font-variant-numeric:tabular-nums;margin-top:4px}
  .stat .sub{font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stat.cut .num{color:var(--cut)}
  .stat .meter{height:6px;border-radius:3px;background:var(--raised);border:1px solid var(--line);margin-top:8px;overflow:hidden}
  .stat .meter i{display:block;height:100%;background:var(--accent);transition:width .3s}
  .stat .linkish{background:none;border:0;padding:0;color:var(--accent);font-weight:600;font-size:12px;text-decoration:underline;text-underline-offset:2px}

  .body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px;padding:0 20px 20px}
  .main{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
  .toolbar{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:0 10px;background:var(--raised);color:var(--muted)}
  .search input{flex:1;border:0;background:none;padding:8px 0;outline:none;color:var(--ink);min-width:0}
  select{border:1px solid var(--line);border-radius:10px;padding:7px 8px;background:var(--raised)}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 11px;font-size:13px;display:inline-flex;gap:6px;align-items:center}
  .chip .n{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px}
  .chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
  .chip[aria-pressed="true"] .n{color:inherit;opacity:.7}
  .bulk{font-size:13px;color:var(--muted)}
  .bulk .btn{padding:5px 10px;font-size:13px}

  .gridwrap{flex:1;overflow:auto;padding:14px;min-height:0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
  .card{position:relative;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:16px 10px 12px;
    display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;cursor:pointer;user-select:none;
    transition:border-color .12s,background .12s,transform .12s;min-width:0}
  .card:hover{border-color:var(--muted)}
  .card:active{transform:scale(.98)}
  .av{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font:700 22px var(--display);color:#fff;
    overflow:hidden;flex:none;transition:filter .15s,opacity .15s;position:relative}
  .av img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
  .uname{font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fname{font-size:12px;color:var(--muted);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:17px}
  .tags{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;min-height:20px}
  .tag{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:500;padding:2px 7px;border-radius:999px;background:var(--raised);color:var(--muted);border:1px solid var(--line)}
  .tag.no{background:var(--cut-soft);color:var(--cut);border-color:transparent}
  .tag.ok{background:var(--ok-soft);color:var(--ok);border-color:transparent}
  .tag.v{color:var(--accent);background:var(--accent-soft);border-color:transparent}
  .mark{position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line);background:var(--surface);display:grid;place-items:center;color:transparent;transition:all .12s}
  .card:hover .mark{border-color:var(--muted)}
  .open{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--muted);opacity:0;transition:opacity .12s}
  .card:hover .open,.open:focus-visible{opacity:1}
  .open:hover{background:var(--raised);color:var(--ink)}
  .card.sel{border-color:var(--cut);background:var(--cut-soft)}
  .card.sel .mark{background:var(--cut);border-color:var(--cut);color:var(--cut-ink)}
  .card.sel .av{filter:grayscale(.85);opacity:.75}
  .card.sel .uname{text-decoration:line-through;text-decoration-color:var(--cut);text-decoration-thickness:2px}
  .card.done{cursor:default;opacity:.55}
  .card.done .mark{display:none}
  .card.done .av{filter:grayscale(1)}
  .stamp{position:absolute;top:44px;left:50%;transform:translateX(-50%) rotate(-8deg);border:2px solid var(--cut);color:var(--cut);
    font:700 12px var(--display);letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:6px;background:var(--surface)}
  .card.now{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
  .more{grid-column:1/-1;text-align:center;color:var(--muted);padding:12px;font-size:13px}

  .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:56px 20px;color:var(--muted);max-width:460px;margin:0 auto}
  .empty h2{font:700 24px/1.2 var(--display);color:var(--ink);text-wrap:balance}
  .empty p{text-wrap:pretty}
  .bar{width:100%;height:8px;border-radius:4px;background:var(--raised);border:1px solid var(--line);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--accent);transition:width .3s}
  .bar.indet i{width:30%;animation:slide 1.2s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}

  .queue{display:flex;flex-direction:column;min-height:0;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
  .qhead{padding:16px 16px 12px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
  .qhead .t{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .qhead h2{font:700 17px var(--display)}
  .qhead .count{font:700 40px/1 var(--display);color:var(--cut);font-variant-numeric:tabular-nums}
  .qhead .est{color:var(--muted);font-size:13px}
  .pill{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)}
  .qlist{flex:1 1 0;overflow:auto;padding:8px 10px;min-height:0;display:flex;flex-direction:column;gap:2px}
  .qitem{display:flex;align-items:center;gap:10px;padding:5px 6px;border-radius:10px}
  .qitem:hover{background:var(--raised)}
  .qitem .av{width:30px;height:30px;font-size:12px}
  .qitem .who{flex:1;min-width:0}
  .qitem .who div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .qitem .who .s{font-size:12px;color:var(--muted)}
  .qitem button{border:0;background:none;color:var(--muted);width:28px;height:28px;border-radius:8px;display:grid;place-items:center}
  .qitem button:hover{background:var(--cut-soft);color:var(--cut)}
  .qempty{color:var(--muted);text-align:center;padding:24px 12px;font-size:13px;text-wrap:pretty}
  .qfoot{padding:12px 16px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
  .qfoot .row{justify-content:space-between}

  .now{padding:18px 16px;display:flex;flex-direction:column;align-items:center;gap:10px;border-bottom:1px solid var(--line)}
  .ring{position:relative;width:132px;height:132px}
  .ring svg{position:absolute;inset:0}
  .ring .av{position:absolute;inset:16px;width:100px;height:100px;font-size:32px}
  .now .who{font-weight:600;font-size:16px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .now .phase{color:var(--muted);font-variant-numeric:tabular-nums}
  .now .bar{margin-top:4px}
  .now .prog{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}

  .log{flex:none;height:200px;overflow:auto;padding:8px 16px;border-top:1px solid var(--line);background:var(--raised);font:12px/1.5 var(--mono);color:var(--muted)}
  .log .ok{color:var(--ok)}
  .log .warn{color:var(--warn)}
  .log .err{color:var(--cut)}

  .backdrop{position:absolute;inset:0;background:rgba(10,12,18,.45);display:grid;place-items:center;padding:16px;z-index:5}
  .modal{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);width:min(520px,100%);max-height:calc(100% - 32px);overflow:auto;padding:22px;display:flex;flex-direction:column;gap:14px}
  .modal h3{font:700 20px/1.2 var(--display)}
  .modal p{color:var(--muted)}
  .modal .foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  .modal textarea{width:100%;min-height:160px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--raised);font:13px/1.5 var(--mono);color:var(--ink);resize:vertical}
  .faces{display:flex;flex-wrap:wrap}
  .faces .av{width:36px;height:36px;font-size:13px;border:2px solid var(--surface);margin-right:-8px}
  .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .seg button{border:1.5px solid var(--line);background:var(--raised);border-radius:12px;padding:10px;text-align:left;display:flex;flex-direction:column;gap:2px}
  .seg button b{font-weight:600}
  .seg button span{font-size:12px;color:var(--muted)}
  .seg button[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
  .fields{display:grid;grid-template-columns:1fr auto;gap:10px 14px;align-items:center}
  .fields label{color:var(--muted)}
  .fields .pair{display:flex;gap:6px;align-items:center}
  .fields input{width:70px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--raised);font-variant-numeric:tabular-nums}
  .toggle{display:flex;gap:10px;align-items:center;cursor:pointer}
  .toggle input{width:18px;height:18px;accent-color:var(--accent)}
  .note{font-size:13px;color:var(--muted);background:var(--raised);border-radius:10px;padding:10px 12px}
  .note.warn{background:var(--warn-soft);color:var(--warn)}

  .fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483647;border:0;border-radius:999px;padding:10px 16px;
    background:#2F45D8;color:#fff;font:600 14px var(--body);box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}

  .vaultbtn svg{color:var(--ok)}
  .vaultpin{position:absolute;top:6px;right:36px;width:28px;height:28px;border-radius:8px;border:0;background:none;display:grid;place-items:center;color:var(--muted);opacity:0;transition:opacity .12s}
  .card:hover .vaultpin,.vaultpin:focus-visible{opacity:1}
  .vaultpin:hover{background:var(--ok-soft);color:var(--ok)}
  .card.safe{border-color:var(--ok);background:var(--ok-soft);cursor:default}
  .card.safe .vaultpin{opacity:1;color:var(--ok)}
  .card.safe .mark{display:none}
  .tag.safe svg{width:11px;height:11px}
  button.tag{cursor:pointer;font-family:inherit}
  .tag.kind.ps{color:var(--ink)}
  .tag.kind.pg{background:var(--page-soft);color:var(--page);border-color:transparent}
  .tag.kind.uk{border-style:dashed}
  .tag.kind.guess{opacity:.85}
  .tag.kind:hover{border-color:var(--muted)}
  .note.safe{background:var(--ok-soft);color:var(--ok);display:flex;gap:6px;align-items:center}
  .modal.wide{width:min(620px,100%)}
  .modal .vt{display:flex;gap:8px;align-items:center}
  .modal .vt svg{color:var(--ok);width:20px;height:20px}
  .vsearch{width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--raised)}
  .vlist{max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:12px;padding:6px}
  .vlist a{color:inherit;font-weight:600;text-decoration:none}
  .vlist a:hover{text-decoration:underline}
  .vlist:empty{display:none}
  .dangerish{color:var(--cut)}
  @media (max-width:980px){
    .app{overflow:auto}
    .body{display:flex;flex-direction:column;flex:none}
    .main{min-height:70vh}
    .gridwrap{max-height:70vh}
    .queue{min-height:420px;order:-1}
  }
  @media (max-width:640px){
    .top,.stats,.body{padding-left:16px;padding-right:16px}
    .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
    .stat .num{font-size:24px}
    .brand span{display:none}
    .grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
    .seg{grid-template-columns:1fr}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  `;

  // ---------- montagem ----------
  const host = document.createElement('div');
  host.id = 'iguf-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<style>' + CSS + '</style>';
  const app = h('div', { class: 'app', role: 'dialog', 'aria-label': 'Insta Unfollow' });
  shadow.appendChild(app);
  document.body.appendChild(host);

  const fab = h('button', { class: 'fab', hidden: true, text: 'Insta Unfollow', onclick: () => show() });
  shadow.appendChild(fab);

  function applyTheme() {
    const root = document.documentElement;
    const t = root.getAttribute('data-theme');
    const dark =
      t === 'dark' ||
      (t !== 'light' &&
        (root.classList.contains('__fb-dark-mode') || matchMedia('(prefers-color-scheme: dark)').matches));
    app.classList.toggle('dark', dark);
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  // avatar: foto do Instagram, ou iniciais coloridas se não houver/não carregar
  function avatar(u) {
    const el = h('span', { class: 'av', 'aria-hidden': 'true' }, initials(u));
    el.style.background = 'hsl(' + hashHue(u.username || '') + ' 42% 52%)';
    if (u.profile_pic_url) {
      const img = h('img', { alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', src: u.profile_pic_url });
      img.addEventListener('error', () => img.remove());
      el.appendChild(img);
    }
    return el;
  }

  // esqueleto da página
  const el = {};
  if (DEMO) {
    app.appendChild(
      h('div', { class: 'demo' },
        h('span', null, h('b', null, 'Demonstração'), ' com contas fictícias. Nada é enviado ao Instagram e o tempo corre 25× mais rápido.'),
        h('button', { onclick: resetDemo }, 'Recomeçar a demonstração')
      )
    );
  }
  el.loadBtn = h('button', { class: 'btn primary', onclick: () => loadList('following') });
  el.followersBtn = h('button', { class: 'btn', onclick: () => loadList('followers') });
  app.appendChild(
    h('div', { class: 'top' },
      h('div', { class: 'brand' }, h('h1', null, 'Insta Unfollow'), h('span', null, 'escolha quem sai, o resto é com o robô')),
      h('div', { class: 'actions' },
        el.loadBtn,
        el.followersBtn,
        el.vaultBtn = h('button', { class: 'btn vaultbtn', html: ICON.shield, onclick: openVault }),
        h('button', { class: 'btn', onclick: openPaste }, 'Marcar por lista'),
        h('button', { class: 'btn', onclick: exportCsv }, 'Exportar CSV'),
        h('button', { class: 'btn icon ghost', title: 'Ritmo e limites', 'aria-label': 'Ritmo e limites', html: ICON.gear, onclick: openSettings }),
        h('button', { class: 'btn icon ghost', title: 'Esconder painel', 'aria-label': 'Esconder painel', html: ICON.min, onclick: hide })
      )
    )
  );

  el.stats = h('div', { class: 'stats' });
  app.appendChild(el.stats);

  el.search = h('input', { id: 'iguf-search', type: 'search', placeholder: 'Buscar por @usuário ou nome', autocomplete: 'off' });
  el.sort = h('select', { id: 'iguf-sort', 'aria-label': 'Ordem' },
    h('option', { value: 'recent' }, 'Seguidos mais recentemente'),
    h('option', { value: 'old' }, 'Seguidos há mais tempo'),
    h('option', { value: 'az' }, 'A–Z')
  );
  el.chips = h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Filtros' });
  el.bulk = h('div', { class: 'row bulk' });
  el.grid = h('div', { class: 'grid' });
  el.gridwrap = h('div', { class: 'gridwrap' }, el.grid);
  el.main = h('section', { class: 'main' },
    h('div', { class: 'toolbar' },
      h('div', { class: 'row' }, h('label', { class: 'search', html: ICON.search }, el.search), el.sort),
      el.chips,
      el.bulk
    ),
    el.gridwrap
  );
  el.queue = h('aside', { class: 'queue', 'aria-label': 'Fila de remoção' });
  el.log = h('div', { class: 'log', 'aria-live': 'polite' });
  app.appendChild(h('div', { class: 'body' }, el.main, el.queue));

  el.sort.value = state.view.sort;
  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = el.search.value.trim().toLowerCase().replace(/^@/, '');
      renderGrid();
    }, 120);
  });
  el.sort.addEventListener('change', () => {
    state.view.sort = el.sort.value;
    saveView();
    renderGrid();
  });

  function log(msg, kind) {
    const line = h('div', { class: kind || '' }, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '  ' + msg);
    el.log.appendChild(line);
    while (el.log.childNodes.length > 300) el.log.removeChild(el.log.firstChild);
    el.log.scrollTop = el.log.scrollHeight;
  }

  // ---------- filtros ----------
  const FILTERS = [
    { key: 'all', label: 'Todos', test: (u) => !isDone(u) },
    { key: 'notback', label: 'Não te seguem', needsFollowers: true, test: (u) => !isDone(u) && !state.followers.has(u.pk) },
    { key: 'back', label: 'Te seguem', needsFollowers: true, test: (u) => !isDone(u) && state.followers.has(u.pk) },
    { key: 'people', label: 'Pessoas', test: (u) => !isDone(u) && classify(u).kind === 'pessoa' },
    { key: 'pages', label: 'Páginas', test: (u) => !isDone(u) && classify(u).kind === 'pagina' },
    { key: 'unknown', label: 'Sem certeza', test: (u) => !isDone(u) && classify(u).kind === '?' },
    { key: 'vault', label: 'No cofre', test: (u) => !isDone(u) && inVault(u) },
    { key: 'verified', label: 'Verificados', test: (u) => !isDone(u) && u.is_verified },
    { key: 'private', label: 'Privados', test: (u) => !isDone(u) && u.is_private },
    { key: 'selected', label: 'Marcados', test: (u) => !isDone(u) && state.selected.has(u.pk) && !inVault(u) },
    { key: 'done', label: 'Removidos', test: (u) => isDone(u) },
  ];
  const currentFilter = () => FILTERS.find((f) => f.key === state.view.filter) || FILTERS[0];

  function matchesQuery(u) {
    const q = state.query;
    return !q || (u.username || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q);
  }

  function computeVisible() {
    const f = currentFilter();
    if (f.needsFollowers && !state.followersLoaded) return [];
    const list = state.users.filter((u) => f.test(u) && matchesQuery(u));
    if (state.view.sort === 'old') list.reverse();
    else if (state.view.sort === 'az') list.sort((a, b) => a.username.localeCompare(b.username));
    return list;
  }

  function renderChips() {
    el.chips.textContent = '';
    for (const f of FILTERS) {
      const n = f.needsFollowers && !state.followersLoaded ? null : state.users.filter(f.test).length;
      el.chips.appendChild(
        h('button', {
          class: 'chip',
          'aria-pressed': String(state.view.filter === f.key),
          onclick: () => {
            state.view.filter = f.key;
            saveView();
            renderGrid();
          },
        }, f.label, h('span', { class: 'n' }, n == null ? '?' : n.toLocaleString('pt-BR')))
      );
    }
  }

  function renderBulk() {
    el.bulk.textContent = '';
    const list = state.visible;
    if (!list.length || state.view.filter === 'done') return;
    const free = list.filter((u) => !inVault(u));
    const unmarked = free.filter((u) => !state.selected.has(u.pk)).length;
    const marked = free.length - unmarked;
    const outVault = free.length;
    const unchecked = list.filter((u) => !state.kinds[u.pk]).length;
    el.bulk.append(
      h('span', null, list.length.toLocaleString('pt-BR') + (list.length === 1 ? ' conta aqui' : ' contas aqui')),
      h('button', { class: 'btn', disabled: !unmarked || null, onclick: () => bulk(free, true) }, 'Marcar todas (' + unmarked + ')'),
      h('button', { class: 'btn ghost', disabled: !marked || null, onclick: () => bulk(free, false) }, 'Desmarcar (' + marked + ')'),
      h('button', { class: 'btn vaultbtn', html: ICON.shield, disabled: !outVault || null, onclick: () => vaultAdd(free) }, 'Guardar no cofre (' + outVault + ')'),
      list.length > free.length
        ? h('button', { class: 'btn ghost', onclick: () => { vaultRemove(list.filter(inVault)); renderGrid(); } }, 'Tirar do cofre (' + (list.length - free.length) + ')')
        : null,
      state.checking
        ? h('button', { class: 'btn ghost', onclick: () => (state.checking.stop = true) }, 'Parar conferência (' + state.checking.done + '/' + state.checking.total + ')')
        : h('button', { class: 'btn ghost', disabled: !unchecked || !!state.run || null, title: 'Pergunta ao Instagram se cada conta é comercial. Uma consulta a cada poucos segundos.', onclick: () => checkKinds(list) }, 'Conferir tipo (' + unchecked + ')')
    );
  }

  // ---------- grade ----------
  const cardEls = new Map();
  const PAGE = 240;

  function card(u, idx) {
    const pk = u.pk;
    const done = isDone(u);
    const sel = state.selected.has(pk) && !done;
    const tags = [];
    if (state.followersLoaded) {
      tags.push(state.followers.has(pk)
        ? h('span', { class: 'tag ok' }, 'te segue')
        : h('span', { class: 'tag no' }, 'não te segue'));
    }
    const k = classify(u);
    const kindLabel = k.kind === 'pagina' ? (k.category ? k.category : 'página') : k.kind === 'pessoa' ? 'pessoa' : 'pessoa ou página?';
    tags.unshift(h('button', {
      class: 'tag kind ' + (k.kind === 'pagina' ? 'pg' : k.kind === 'pessoa' ? 'ps' : 'uk') + (k.source === 'palpite' ? ' guess' : ''),
      'data-kind': '1',
      html: k.kind === 'pagina' ? ICON.store : k.kind === 'pessoa' ? ICON.person : '',
      title: (k.source === 'palpite' ? 'Palpite pelo nome. ' : k.source === 'perfil' ? 'Conferido no perfil. ' : 'Você definiu. ') + 'Clique para trocar.',
    }, kindLabel));
    if (u.is_verified) tags.push(h('span', { class: 'tag v', html: ICON.badge }, 'verificado'));
    if (u.is_private) tags.push(h('span', { class: 'tag', html: ICON.lock }, 'privado'));
    const vault = inVault(u);
    if (vault && !done) tags.unshift(h('span', { class: 'tag ok safe', html: ICON.shieldOn }, 'no cofre'));
    const c = h('div', {
      class: 'card' + (sel && !vault ? ' sel' : '') + (vault ? ' safe' : '') + (done ? ' done' : '') + (state.run && state.run.current === pk ? ' now' : ''),
      role: done ? null : 'checkbox',
      'aria-checked': done ? null : String(sel),
      tabindex: done ? null : '0',
      'data-pk': pk,
      'data-idx': idx,
      title: done ? null : vault ? 'Protegida pelo cofre' : sel ? 'Clique para manter' : 'Clique para remover',
    },
      done ? null : h('span', { class: 'mark', html: ICON.check }),
      done ? null : h('button', {
        class: 'vaultpin',
        'data-vault': '1',
        html: vault ? ICON.shieldOn : ICON.shield,
        title: vault ? 'No cofre: protegida contra remoção. Clique para tirar.' : 'Guardar no cofre',
        'aria-label': (vault ? 'Tirar @' : 'Guardar @') + u.username + (vault ? ' do cofre' : ' no cofre'),
      }),
      h('a', {
        class: 'open',
        href: 'https://www.instagram.com/' + encodeURIComponent(u.username) + '/',
        target: '_blank',
        rel: 'noopener',
        title: 'Abrir perfil',
        'aria-label': 'Abrir perfil de @' + u.username,
        html: ICON.out,
      }),
      avatar(u),
      done ? h('span', { class: 'stamp' }, 'removido') : null,
      h('div', { class: 'uname' }, '@' + u.username),
      h('div', { class: 'fname' }, u.full_name || ''),
      h('div', { class: 'tags' }, tags)
    );
    cardEls.set(pk, c);
    return c;
  }

  let sentinelObs;
  function renderGrid() {
    state.visible = computeVisible();
    state.renderLimit = PAGE;
    state.lastClicked = null;
    el.grid.textContent = '';
    cardEls.clear();
    el.gridwrap.scrollTop = 0;
    renderChips();
    renderBulk();

    const f = currentFilter();
    if (state.loading && state.loading.kind === 'following' && !state.users.length) {
      el.grid.appendChild(loadingState());
      return;
    }
    if (!state.users.length) {
      el.grid.appendChild(
        h('div', { class: 'more' },
          h('div', { class: 'empty' },
            h('h2', null, 'Veja todo mundo que você segue'),
            h('p', null, 'Eu busco sua lista direto do Instagram, 50 contas por vez e com pausas. Mil contas levam cerca de um minuto.'),
            h('button', { class: 'btn primary big', onclick: () => loadList('following'), disabled: !!state.loading || null }, 'Carregar quem eu sigo')
          )
        )
      );
      return;
    }
    if (f.needsFollowers && !state.followersLoaded) {
      el.grid.appendChild(
        h('div', { class: 'more' },
          h('div', { class: 'empty' },
            state.loading && state.loading.kind === 'followers'
              ? [h('h2', null, 'Carregando seus seguidores…'), h('p', null, state.loading.count.toLocaleString('pt-BR') + ' até agora'), h('div', { class: 'bar indet' }, h('i'))]
              : [
                  h('h2', null, 'Preciso da sua lista de seguidores'),
                  h('p', null, 'Para saber quem não te segue de volta, eu comparo quem você segue com quem te segue.'),
                  h('button', { class: 'btn primary big', onclick: () => loadList('followers'), disabled: !!state.loading || null }, 'Carregar meus seguidores'),
                ]
          )
        )
      );
      return;
    }
    if (!state.visible.length) {
      el.grid.appendChild(h('div', { class: 'more' }, state.query ? 'Ninguém com "' + state.query + '" neste filtro.' : 'Nenhuma conta neste filtro.'));
      return;
    }
    appendCards();
  }

  function appendCards() {
    const start = el.grid.querySelectorAll('.card').length;
    const end = Math.min(state.visible.length, state.renderLimit);
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) frag.appendChild(card(state.visible[i], i));
    const old = el.grid.querySelector('.more.sentinel');
    if (old) old.remove();
    el.grid.appendChild(frag);
    if (end < state.visible.length) {
      const s = h('div', { class: 'more sentinel' }, 'Mostrando ' + end + ' de ' + state.visible.length.toLocaleString('pt-BR') + '…');
      el.grid.appendChild(s);
      if (sentinelObs) sentinelObs.disconnect();
      sentinelObs = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          state.renderLimit += PAGE;
          appendCards();
        }
      }, { root: el.gridwrap, rootMargin: '400px' });
      sentinelObs.observe(s);
    }
  }

  function loadingState() {
    return h('div', { class: 'more' },
      h('div', { class: 'empty' },
        h('h2', null, 'Carregando quem você segue…'),
        h('p', null, (state.loading ? state.loading.count : 0).toLocaleString('pt-BR') + ' contas até agora'),
        h('div', { class: 'bar indet' }, h('i'))
      )
    );
  }

  // ---------- seleção ----------
  function setSel(pk, on) {
    const u = state.byPk.get(pk);
    if (!u || isDone(u)) return;
    if (on && inVault(u)) return;
    if (on) state.selected.add(pk);
    else state.selected.delete(pk);
    const c = cardEls.get(pk);
    if (c) {
      c.classList.toggle('sel', on);
      c.setAttribute('aria-checked', String(on));
      c.title = on ? 'Clique para manter' : 'Clique para remover';
    }
  }

  let refreshQueued = false;
  function afterSelection() {
    saveSelected();
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      renderStats();
      renderChips();
      renderBulk();
      renderQueue();
    });
  }

  function bulk(list, on) {
    for (const u of list) setSel(u.pk, on);
    afterSelection();
    log((on ? 'Marcadas ' : 'Desmarcadas ') + list.length + ' contas.');
  }

  el.grid.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const c = e.target.closest('.card');
    if (!c || c.classList.contains('done')) return;
    const pk = c.dataset.pk;
    if (e.target.closest('[data-vault]')) {
      const u = state.byPk.get(pk);
      if (inVault(u)) vaultRemove([u]);
      else vaultAdd([u]);
      return;
    }
    if (e.target.closest('[data-kind]')) {
      const u = state.byPk.get(pk);
      const cur = classify(u).kind;
      state.kinds[pk] = { kind: cur === 'pessoa' ? 'pagina' : 'pessoa', category: '', source: 'voce' };
      saveKinds();
      refreshCard(u);
      afterSelection();
      return;
    }
    if (state.vault.has(pk)) {
      log('@' + state.byPk.get(pk).username + ' está no cofre. Tire do cofre (escudo no cartão) para poder remover.', 'warn');
      return;
    }
    const idx = Number(c.dataset.idx);
    const on = !state.selected.has(pk);
    if (e.shiftKey && state.lastClicked != null) {
      const [a, b] = [Math.min(state.lastClicked, idx), Math.max(state.lastClicked, idx)];
      for (let i = a; i <= b; i++) setSel(state.visible[i].pk, on);
    } else {
      setSel(pk, on);
    }
    state.lastClicked = idx;
    afterSelection();
  });
  el.grid.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const c = e.target.closest('.card');
    if (!c || e.target.closest('a') || e.target.closest('button')) return;
    e.preventDefault();
    c.click();
  });

  // ---------- números do topo ----------
  function renderStats() {
    const active = state.users.filter((u) => !isDone(u));
    const notBack = state.followersLoaded ? active.filter((u) => !state.followers.has(u.pk)).length : null;
    const q = queue().length;
    const d = daily();
    const pct = Math.min(100, (d.count / Math.max(1, state.cfg.dailyLimit)) * 100);
    el.stats.textContent = '';
    el.stats.append(
      h('div', { class: 'stat' },
        h('div', { class: 'lbl' }, 'Seguindo'),
        h('div', { class: 'num' }, active.length.toLocaleString('pt-BR')),
        h('div', { class: 'sub' }, state.users.length
          ? active.filter((u) => classify(u).kind === 'pessoa').length.toLocaleString('pt-BR') + ' pessoas · ' +
            active.filter((u) => classify(u).kind === 'pagina').length.toLocaleString('pt-BR') + ' páginas · ' +
            state.vault.size + ' no cofre'
          : 'lista ainda não carregada')
      ),
      h('div', { class: 'stat' },
        h('div', { class: 'lbl' }, 'Não te seguem'),
        h('div', { class: 'num' }, notBack == null ? '–' : notBack.toLocaleString('pt-BR')),
        notBack == null
          ? h('div', { class: 'sub' }, h('button', { class: 'linkish', onclick: () => loadList('followers'), disabled: !!state.loading || null }, 'carregar seguidores'))
          : h('div', { class: 'sub' }, active.length ? Math.round((notBack / active.length) * 100) + '% de quem você segue' : '')
      ),
      h('div', { class: 'stat cut' },
        h('div', { class: 'lbl' }, 'Marcados para sair'),
        h('div', { class: 'num' }, q.toLocaleString('pt-BR')),
        h('div', { class: 'sub' }, q ? estimate(q) : 'clique nos cartões para marcar')
      ),
      h('div', { class: 'stat' },
        h('div', { class: 'lbl' }, 'Removidos hoje'),
        h('div', { class: 'num' }, String(d.count), h('span', { style: 'font-size:16px;color:var(--muted)' }, ' / ' + state.cfg.dailyLimit)),
        h('div', { class: 'meter' }, h('i', { style: 'width:' + pct + '%' }))
      )
    );
    el.vaultBtn.lastChild.nodeType === 3 ? (el.vaultBtn.lastChild.textContent = 'Cofre (' + state.vault.size + ')') : el.vaultBtn.append('Cofre (' + state.vault.size + ')');
    el.loadBtn.textContent = state.loading && state.loading.kind === 'following'
      ? 'Carregando… ' + state.loading.count
      : state.users.length ? 'Atualizar lista' : 'Carregar quem eu sigo';
    el.followersBtn.textContent = state.loading && state.loading.kind === 'followers'
      ? 'Seguidores… ' + state.loading.count
      : state.followersLoaded ? 'Atualizar seguidores' : 'Carregar seguidores';
    el.loadBtn.disabled = !!state.loading || !!state.run;
    el.followersBtn.disabled = !!state.loading || !!state.run;
  }

  function estimate(n) {
    const c = state.cfg;
    const per = (c.delayMin + Math.max(c.delayMin, c.delayMax)) / 2 +
      (c.batchSize > 0 ? ((c.batchPauseMin + Math.max(c.batchPauseMin, c.batchPauseMax)) / 2) * 60 / c.batchSize : 0);
    const left = Math.max(0, c.dailyLimit - daily().count);
    if (n <= left) return '≈ ' + fmtDur(n * per * TIME_SCALE) + (DEMO ? ' na demonstração' : ' no ritmo atual');
    const days = (left ? 1 : 0) + Math.ceil((n - left) / Math.max(1, c.dailyLimit));
    return '≈ ' + days + ' dias, no limite de ' + c.dailyLimit + ' por dia';
  }

  // ---------- fila ----------
  const qref = {};
  function renderQueue() {
    // o registro é recolocado no painel a cada atualização; mantém sempre a última linha à vista
    requestAnimationFrame(() => (el.log.scrollTop = el.log.scrollHeight));
    el.queue.textContent = '';
    const q = queue();
    if (state.run) {
      const r = state.run;
      const u = state.byPk.get(r.current) || q[0];
      const circ = 2 * Math.PI * 60;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 132 132');
      svg.innerHTML =
        '<circle cx="66" cy="66" r="60" fill="none" stroke="var(--line)" stroke-width="6"/>' +
        '<circle class="arc" cx="66" cy="66" r="60" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 66 66)" stroke-dasharray="' + circ + '" stroke-dashoffset="0"/>';
      qref.arc = svg.querySelector('.arc');
      qref.circ = circ;
      qref.phase = h('div', { class: 'phase' }, '');
      qref.bar = h('i', { style: 'width:' + (r.done / Math.max(1, r.total)) * 100 + '%' });
      qref.prog = h('div', { class: 'prog' }, '');
      el.queue.append(
        h('div', { class: 'qhead' },
          h('div', { class: 't' }, h('h2', null, 'Removendo'), state.cfg.dryRun ? h('span', { class: 'pill' }, 'modo teste') : null)
        ),
        h('div', { class: 'now' },
          h('div', { class: 'ring' }, svg, u ? avatar(u) : null),
          h('div', { class: 'who' }, u ? '@' + u.username : 'Terminando…'),
          qref.phase,
          h('div', { class: 'bar' }, qref.bar),
          qref.prog,
          h('button', { class: 'btn big', onclick: stopRun, disabled: state.stopRequested || null }, state.stopRequested ? 'Parando…' : 'Pausar')
        ),
        queueList(q.filter((x) => x.pk !== r.current), 'A seguir'),
        el.log
      );
      tick();
      return;
    }

    const limitHit = daily().count >= state.cfg.dailyLimit;
    el.queue.append(
      h('div', { class: 'qhead' },
        h('div', { class: 't' },
          h('h2', null, 'Fila de remoção'),
          state.cfg.dryRun ? h('span', { class: 'pill' }, 'modo teste') : null
        ),
        h('div', { class: 'count' }, q.length.toLocaleString('pt-BR')),
        h('div', { class: 'est' }, q.length ? estimate(q.length) : 'Nenhuma conta marcada ainda.')
      ),
      queueList(q, null),
      h('div', { class: 'qfoot' },
        limitHit ? h('div', { class: 'note warn' }, 'Você chegou ao limite de hoje (' + state.cfg.dailyLimit + '). A fila fica guardada para amanhã.') : null,
        h('button', { class: 'btn cut big', disabled: !q.length || limitHit || !!state.loading || null, onclick: confirmStart },
          q.length ? 'Começar a remover ' + q.length : 'Começar a remover'),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', html: ICON.gear, onclick: openSettings }, 'Ritmo: ' + (state.cfg.preset === 'cauteloso' ? 'cauteloso' : state.cfg.preset === 'normal' ? 'normal' : 'personalizado')),
          h('button', { class: 'btn ghost', disabled: !q.length || null, onclick: () => bulk(q, false) }, 'Esvaziar fila')
        )
      ),
      el.log
    );
  }

  function queueList(list, title) {
    const box = h('div', { class: 'qlist' });
    if (title && list.length) box.appendChild(h('div', { class: 'qempty', style: 'padding:4px 6px;text-align:left' }, title));
    if (!list.length && !title) {
      box.appendChild(h('div', { class: 'qempty' }, 'Clique nos cartões à esquerda para colocar contas aqui. Use o filtro "Não te seguem" para começar pelos óbvios.'));
    }
    const MAXQ = 150;
    for (const u of list.slice(0, MAXQ)) {
      box.appendChild(
        h('div', { class: 'qitem' },
          avatar(u),
          h('div', { class: 'who' },
            h('div', null, '@' + u.username),
            h('div', { class: 's' }, u.full_name || (state.followersLoaded ? (state.followers.has(u.pk) ? 'te segue' : 'não te segue') : ''))
          ),
          state.run ? null : h('button', { 'aria-label': 'Tirar @' + u.username + ' da fila', title: 'Manter esta conta', html: ICON.x, onclick: () => { setSel(u.pk, false); afterSelection(); } })
        )
      );
    }
    if (list.length > MAXQ) box.appendChild(h('div', { class: 'qempty' }, '+ ' + (list.length - MAXQ) + ' contas'));
    return box;
  }

  function tick() {
    const r = state.run;
    if (!r || !qref.phase) return;
    const left = Math.max(0, (r.until - Date.now()) / 1000);
    let frac = 0;
    if (r.phase === 'removing') {
      qref.phase.textContent = 'Deixando de seguir…';
      frac = 1;
    } else if (r.phase === 'waiting' || r.phase === 'pause') {
      qref.phase.textContent = (r.phase === 'pause' ? 'Pausa longa para não chamar atenção: ' : 'Próxima em ') + fmtClock(left);
      frac = r.phaseLen ? 1 - left / r.phaseLen : 0;
    }
    qref.arc.setAttribute('stroke-dashoffset', String(qref.circ * (1 - frac)));
    qref.bar.style.width = (r.done / Math.max(1, r.total)) * 100 + '%';
    qref.prog.textContent = r.done + ' de ' + r.total + ' removidas nesta rodada · hoje ' + daily().count + '/' + state.cfg.dailyLimit;
  }

  // ---------- janelas ----------
  let backdrop = null;
  function openModal(content) {
    closeModal();
    backdrop = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === backdrop) closeModal(); } }, content);
    app.appendChild(backdrop);
    const f = content.querySelector('textarea, button.primary, button.cut, button');
    if (f) f.focus();
  }
  function closeModal() {
    if (backdrop) backdrop.remove();
    backdrop = null;
  }
  app.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop) closeModal();
  });

  function confirmStart() {
    const q = queue();
    if (!q.length) return;
    const left = Math.max(0, state.cfg.dailyLimit - daily().count);
    const now = Math.min(left, q.length);
    openModal(
      h('div', { class: 'modal', role: 'alertdialog', 'aria-label': 'Confirmar' },
        h('h3', null, 'Deixar de seguir ' + q.length + (q.length === 1 ? ' conta?' : ' contas?')),
        h('div', { class: 'faces' }, q.slice(0, 14).map(avatar)),
        h('p', null,
          now < q.length
            ? 'Hoje saem ' + now + ' (seu limite diário). As outras ' + (q.length - now) + ' ficam na fila para os próximos dias.'
            : 'Vai levar ' + estimate(q.length).replace('≈ ', 'cerca de ') + '.'),
        state.vault.size ? h('div', { class: 'note safe' }, h('span', { html: ICON.shieldOn }), ' As ' + state.vault.size + ' contas do cofre ficam de fora, mesmo que estejam marcadas.') : null,
        state.cfg.dryRun
          ? h('div', { class: 'note warn' }, 'Modo teste ligado: nada será desfeito de verdade.')
          : h('div', { class: 'note' }, 'Deixe esta aba aberta. Você pode pausar quando quiser e continuar depois.'),
        h('div', { class: 'foot' },
          h('button', { class: 'btn', onclick: closeModal }, 'Cancelar'),
          h('button', { class: 'btn cut', onclick: () => { closeModal(); runQueue(); } }, 'Sim, começar')
        )
      )
    );
  }

  function openPaste() {
    const ta = h('textarea', { id: 'iguf-paste', placeholder: '@fulano\nhttps://www.instagram.com/ciclano/\nbeltrano' });
    const info = h('p', null, 'Cole @usuários ou links de perfil, um por linha ou separados por vírgula. Serve também para a lista do export de dados do Instagram.');
    openModal(
      h('div', { class: 'modal' },
        h('h3', null, 'Marcar por lista'),
        info,
        ta,
        h('div', { class: 'foot' },
          h('button', { class: 'btn', onclick: closeModal }, 'Fechar'),
          h('button', { class: 'btn primary', onclick: () => (info.textContent = applyPaste(ta.value)) }, 'Marcar essas contas')
        )
      )
    );
  }

  function applyPaste(text) {
    if (!state.users.length) return 'Carregue antes a lista de quem você segue.';
    const byName = new Map(state.users.map((u) => [(u.username || '').toLowerCase(), u.pk]));
    const names = new Set(
      text.split(/[\s,;]+/).filter(Boolean).map((t) => {
        const m = t.match(/instagram\.com\/([^/?#]+)/i);
        return (m ? m[1] : t).replace(/^@/, '').toLowerCase();
      })
    );
    let hit = 0;
    const miss = [];
    for (const n of names) {
      const pk = byName.get(n);
      if (pk && !state.done.has(pk)) {
        setSel(pk, true);
        hit++;
      } else if (!pk) miss.push(n);
    }
    afterSelection();
    const msg = hit + (hit === 1 ? ' conta marcada.' : ' contas marcadas.') +
      (miss.length ? ' ' + miss.length + ' não estão na sua lista: ' + miss.slice(0, 8).join(', ') + (miss.length > 8 ? '…' : '') : '');
    log('Marcar por lista: ' + msg);
    return msg;
  }

  function openSettings() {
    const c = state.cfg;
    const inputs = {};
    const num = (key, min) => (inputs[key] = h('input', { id: 'iguf-' + key, type: 'number', min: String(min), value: String(c[key]) }));
    const segBtn = (key, title, sub) =>
      h('button', { 'aria-pressed': String(c.preset === key), 'data-preset': key }, h('b', null, title), h('span', null, sub));
    const seg = h('div', { class: 'seg' },
      segBtn('cauteloso', 'Cauteloso', '60 por dia, 1 a 2 min entre cada'),
      segBtn('normal', 'Normal', '150 por dia, 40 a 90 s entre cada'),
      segBtn('custom', 'Personalizado', 'você define os números')
    );
    const dry = h('input', { id: 'iguf-dry', type: 'checkbox' });
    dry.checked = !!c.dryRun;
    const fields = h('div', { class: 'fields' },
      h('label', { for: 'iguf-delayMin' }, 'Espera entre cada unfollow (segundos)'),
      h('div', { class: 'pair' }, num('delayMin', 5), 'a', num('delayMax', 5)),
      h('label', { for: 'iguf-batchSize' }, 'Pausa longa a cada quantos'),
      h('div', { class: 'pair' }, num('batchSize', 0)),
      h('label', { for: 'iguf-batchPauseMin' }, 'Duração da pausa longa (minutos)'),
      h('div', { class: 'pair' }, num('batchPauseMin', 0), 'a', num('batchPauseMax', 0)),
      h('label', { for: 'iguf-dailyLimit' }, 'Limite por dia'),
      h('div', { class: 'pair' }, num('dailyLimit', 1))
    );
    const fill = (vals) => Object.entries(vals).forEach(([k, v]) => inputs[k] && (inputs[k].value = String(v)));
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (PRESETS[b.dataset.preset]) fill(PRESETS[b.dataset.preset]);
    });
    fields.addEventListener('input', () => seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.preset === 'custom'))));
    openModal(
      h('div', { class: 'modal' },
        h('h3', null, 'Ritmo e limites'),
        h('p', null, 'Quanto mais devagar, menor a chance de o Instagram bloquear a ação. Contas novas ou que acabaram de trocar de senha devem usar o cauteloso.'),
        seg,
        fields,
        h('label', { class: 'toggle', for: 'iguf-dry' }, dry, h('span', null, h('b', null, 'Modo teste'), ' (simula tudo sem deixar de seguir ninguém)')),
        h('div', { class: 'foot' },
          h('button', { class: 'btn', onclick: closeModal }, 'Cancelar'),
          h('button', {
            class: 'btn primary',
            onclick: () => {
              const pressed = seg.querySelector('[aria-pressed="true"]');
              for (const [k, inp] of Object.entries(inputs)) c[k] = Math.max(Number(inp.min) || 0, Math.round(Number(inp.value) || 0));
              if (c.delayMax < c.delayMin) c.delayMax = c.delayMin;
              if (c.batchPauseMax < c.batchPauseMin) c.batchPauseMax = c.batchPauseMin;
              c.preset = pressed ? pressed.dataset.preset : 'custom';
              c.dryRun = dry.checked;
              saveCfg();
              closeModal();
              log('Ritmo salvo: ' + c.delayMin + '–' + c.delayMax + ' s, limite ' + c.dailyLimit + '/dia' + (c.dryRun ? ', modo teste' : '') + '.');
              renderStats();
              renderQueue();
            },
          }, 'Salvar')
        )
      )
    );
  }

  // ---------- ações ----------
  async function loadList(kind) {
    if (state.loading || state.run) return;
    state.loading = { kind, count: 0 };
    state.stopRequested = false;
    log(kind === 'following' ? 'Carregando quem você segue…' : 'Carregando seus seguidores…');
    renderStats();
    renderGrid();
    let lastPaint = 0;
    try {
      const users = await api.list(kind, (n) => {
        state.loading.count = n;
        if (Date.now() - lastPaint > 400) {
          lastPaint = Date.now();
          renderStats();
          const p = el.grid.querySelector('.empty p');
          if (p && /até agora/.test(p.textContent)) p.textContent = n.toLocaleString('pt-BR') + (kind === 'following' ? ' contas até agora' : ' até agora');
        }
      }, () => state.stopRequested);
      if (kind === 'following') {
        setUsers(users);
        store.set(K.users, state.users);
        reconcileVault();
        log('Você segue ' + users.length + ' contas.', 'ok');
      } else {
        state.followers = new Set(users.map((u) => u.pk));
        state.followersLoaded = true;
        store.set(K.followers, [...state.followers]);
        log(users.length + ' seguidores carregados.', 'ok');
      }
    } catch (e) {
      log('Não consegui carregar: ' + e.message, 'err');
    } finally {
      state.loading = null;
      renderStats();
      renderGrid();
      renderQueue();
    }
  }

  async function waitPhase(phase, seconds) {
    const r = state.run;
    r.phase = phase;
    r.phaseLen = seconds;
    r.until = Date.now() + seconds * 1000;
    while (Date.now() < r.until && !state.stopRequested) {
      tick();
      await sleep(250);
    }
  }

  async function runQueue() {
    const q = queue();
    if (!q.length || state.run) return;
    const c = state.cfg;
    state.stopRequested = false;
    let fails = 0;
    state.run = { total: Math.min(q.length, Math.max(0, c.dailyLimit - daily().count)), done: 0, current: q[0].pk, phase: 'removing', until: 0, phaseLen: 0 };
    log((c.dryRun ? '[teste] ' : '') + 'Começando: ' + state.run.total + ' nesta rodada.');
    renderStats();
    renderQueue();
    try {
      for (const u of q) {
        if (state.stopRequested) break;
        if (!state.selected.has(u.pk) || isDone(u) || inVault(u)) continue; // desmarcada ou guardada no cofre durante a rodada
        if (daily().count >= c.dailyLimit) {
          log('Limite de ' + c.dailyLimit + ' por dia atingido. O resto fica na fila para amanhã.', 'warn');
          break;
        }
        const prev = cardEls.get(state.run.current);
        if (prev) prev.classList.remove('now');
        state.run.current = u.pk;
        state.run.phase = 'removing';
        const ce = cardEls.get(u.pk);
        if (ce) {
          ce.classList.add('now');
          ce.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        renderQueue();
        try {
          if (c.dryRun) await sleep(400);
          else await api.unfollow(u.pk, u.username);
          fails = 0;
        } catch (e) {
          if (e.kind === 'rate' || e.kind === 'blocked') {
            log(e.message + ' Parei por segurança. Espere pelo menos 24 h e diminua o ritmo antes de continuar.', 'err');
            break;
          }
          if (e.kind === 'auth') {
            log(e.message, 'err');
            break;
          }
          log('Não consegui remover @' + u.username + ' (' + e.message + '). Pulei.', 'warn');
          if (++fails >= 3) {
            log('Três falhas seguidas. Parei para não gastar a fila à toa. Se continuar, me mande este registro.', 'err');
            break;
          }
          continue;
        }
        state.done.add(u.pk);
        state.selected.delete(u.pk);
        saveDone();
        saveSelected();
        const total = bumpDaily();
        state.run.done++;
        log((c.dryRun ? '[teste] ' : '') + 'Deixou de seguir @' + u.username + ' (hoje: ' + total + ')', 'ok');
        if (ce) {
          const fresh = card(u, Number(ce.dataset.idx));
          fresh.classList.remove('now');
          ce.replaceWith(fresh);
        }
        renderStats();
        renderChips();

        if (state.run.done >= state.run.total || state.stopRequested) break;
        let wait = rand(c.delayMin, Math.max(c.delayMin, c.delayMax));
        let phase = 'waiting';
        if (c.batchSize > 0 && state.run.done % c.batchSize === 0) {
          wait += 60 * rand(c.batchPauseMin, Math.max(c.batchPauseMin, c.batchPauseMax));
          phase = 'pause';
        }
        if (c.dryRun && !DEMO) wait = Math.min(wait, 2);
        state.run.current = queue()[0] ? queue()[0].pk : null;
        renderQueue();
        await waitPhase(phase, wait * TIME_SCALE);
      }
    } finally {
      const done = state.run.done;
      const prev = cardEls.get(state.run.current);
      if (prev) prev.classList.remove('now');
      state.run = null;
      state.stopRequested = false;
      log('Rodada encerrada: ' + done + ' removidas, ' + queue().length + ' ainda na fila.', 'ok');
      renderStats();
      renderGrid();
      renderQueue();
    }
  }

  function stopRun() {
    if (!state.run) return;
    state.stopRequested = true;
    log('Pausando…', 'warn');
    renderQueue();
  }

  function saveFile(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- cofre ----------
  function refreshCard(u) {
    const old = cardEls.get(u.pk);
    if (old) old.replaceWith(card(u, Number(old.dataset.idx)));
  }

  function vaultAdd(list) {
    let n = 0;
    for (const u of list) {
      if (!u || state.vault.has(u.pk)) continue;
      state.vault.set(u.pk, { pk: u.pk, username: u.username, full_name: u.full_name || '', added: today() });
      state.selected.delete(u.pk);
      refreshCard(u);
      n++;
    }
    saveVault();
    afterSelection();
    log(n === 1 ? '@' + list[0].username + ' guardada no cofre.' : n + ' contas guardadas no cofre.', 'ok');
  }

  function vaultRemove(list) {
    for (const u of list) {
      for (const [pk, v] of [...state.vault]) if (pk === u.pk || lower(v.username) === lower(u.username)) state.vault.delete(pk);
      const live = state.byPk.get(u.pk);
      if (live) refreshCard(live);
    }
    saveVault();
    afterSelection();
    log(list.length === 1 ? '@' + list[0].username + ' saiu do cofre.' : list.length + ' contas saíram do cofre.');
  }

  function vaultJson() {
    return JSON.stringify({ tipo: 'insta-unfollow-cofre', versao: 1, salvo_em: new Date().toISOString(), contas: [...state.vault.values()] }, null, 2);
  }

  function importVault(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // aceita também uma lista simples de @, um por linha
      data = { contas: text.split(/[\s,;]+/).filter(Boolean).map((t) => ({ username: t.replace(/^@/, '').replace(/.*instagram\.com\/([^/?#]+).*/i, '$1') })) };
    }
    const contas = Array.isArray(data) ? data : data.contas || [];
    const byName = new Map(state.users.map((u) => [u.username.toLowerCase(), u]));
    let n = 0;
    for (const c of contas) {
      if (!c || !c.username) continue;
      const live = byName.get(String(c.username).toLowerCase());
      const pk = live ? live.pk : String(c.pk || 'u:' + c.username.toLowerCase());
      if (state.vault.has(pk)) continue;
      state.vault.set(pk, { pk, username: live ? live.username : c.username, full_name: (live && live.full_name) || c.full_name || '', added: c.added || today() });
      state.selected.delete(pk);
      n++;
    }
    saveVault();
    renderGrid();
    afterSelection();
    log(n + ' contas adicionadas ao cofre pelo arquivo.', 'ok');
    return n;
  }

  function openVault() {
    const search = h('input', { id: 'iguf-vault-search', type: 'search', placeholder: 'Buscar no cofre', autocomplete: 'off', class: 'vsearch' });
    const listBox = h('div', { class: 'vlist' });
    const info = h('p', null, '');
    const file = h('input', { id: 'iguf-vault-file', type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true });
    const people = state.users.filter((u) => !isDone(u) && !inVault(u) && classify(u).kind === 'pessoa');

    const bulkBox = h('div', { class: 'row' });
    let armed = null; // esvaziar pede um segundo clique para confirmar
    function paintBulk(items, q) {
      bulkBox.textContent = '';
      if (!state.vault.size) return;
      if (q && items.length) {
        bulkBox.appendChild(
          h('button', { class: 'btn', onclick: () => { vaultRemove(items); paint(); } },
            'Tirar ' + (items.length === 1 ? 'esta conta' : 'estas ' + items.length + ' contas') + ' do cofre')
        );
      }
      bulkBox.appendChild(
        h('button', {
          class: 'btn ghost dangerish',
          onclick: () => {
            if (armed) {
              clearTimeout(armed);
              armed = null;
              vaultRemove([...state.vault.values()]);
              paint();
              return;
            }
            armed = setTimeout(() => { armed = null; paint(); }, 6000);
            paint();
          },
        }, armed ? 'Clique de novo para tirar todas as ' + state.vault.size : 'Esvaziar cofre')
      );
      if (armed) bulkBox.appendChild(h('span', { class: 'bulk' }, 'Elas voltam a poder ser removidas. Baixe uma cópia antes, se quiser guardar a lista.'));
    }

    function paint() {
      const q = norm(search.value.trim().replace(/^@/, ''));
      const items = [...state.vault.values()]
        .filter((v) => !q || norm(v.username).includes(q) || norm(v.full_name).includes(q))
        .sort((a, b) => a.username.localeCompare(b.username));
      paintBulk(items, q);
      info.textContent = state.vault.size
        ? state.vault.size + (state.vault.size === 1 ? ' conta protegida.' : ' contas protegidas.') + ' Elas nunca entram na fila de remoção, mesmo se você marcar todas.'
        : 'O cofre está vazio. Guarde aqui quem você não quer perder: clique no escudo de um cartão, use "Guardar no cofre" num filtro, ou o botão abaixo.';
      listBox.textContent = '';
      for (const v of items.slice(0, 400)) {
        const live = state.byPk.get(v.pk);
        listBox.appendChild(
          h('div', { class: 'qitem' },
            avatar(live || v),
            h('div', { class: 'who' },
              h('div', null, h('a', { href: 'https://www.instagram.com/' + encodeURIComponent(v.username) + '/', target: '_blank', rel: 'noopener' }, '@' + v.username)),
              h('div', { class: 's' }, (v.full_name || '') + (live || !state.users.length ? '' : (v.full_name ? ' · ' : '') + 'você não segue mais'))
            ),
            h('button', { 'aria-label': 'Tirar @' + v.username + ' do cofre', title: 'Tirar do cofre', html: ICON.x, onclick: () => { vaultRemove([v]); paint(); } })
          )
        );
      }
      if (items.length > 400) listBox.appendChild(h('div', { class: 'qempty' }, '+ ' + (items.length - 400) + ' contas. Use a busca.'));
    }
    search.addEventListener('input', paint);
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        importVault(String(r.result || ''));
        paint();
      };
      r.readAsText(f);
    });
    paint();
    openModal(
      h('div', { class: 'modal wide' },
        h('h3', { class: 'vt', html: ICON.shieldOn }, 'Cofre'),
        info,
        people.length
          ? h('button', { class: 'btn vaultbtn', html: ICON.shield, onclick: () => { vaultAdd(people); paint(); } },
              'Guardar todas as ' + people.length + ' contas que parecem pessoas')
          : null,
        search,
        bulkBox,
        listBox,
        h('div', { class: 'note' }, 'O cofre fica salvo neste navegador. Baixe uma cópia para não perder se limpar os dados do navegador ou trocar de computador.'),
        h('div', { class: 'foot' },
          file,
          h('button', { class: 'btn', onclick: () => file.click() }, 'Importar cópia'),
          h('button', {
            class: 'btn',
            disabled: !state.vault.size || null,
            onclick: () => {
              const text = [...state.vault.values()].map((v) => '@' + v.username).join('\n');
              (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
                .then(() => log('Lista do cofre copiada (' + state.vault.size + ' @).', 'ok'))
                .catch(() => log('Não consegui copiar. Use "Baixar cópia".', 'warn'));
            },
          }, 'Copiar @'),
          h('button', {
            class: 'btn primary',
            disabled: !state.vault.size || null,
            onclick: () => {
              if (DEMO) return log('Na versão de verdade, este botão baixa o arquivo do cofre (.json).', 'warn');
              saveFile('cofre-instagram-' + today() + '.json', vaultJson(), 'application/json');
              log('Cópia do cofre baixada.', 'ok');
            },
          }, 'Baixar cópia'),
          h('button', { class: 'btn', onclick: closeModal }, 'Fechar')
        )
      )
    );
  }

  // ---------- conferir tipo no perfil ----------
  async function checkKinds(list) {
    if (state.checking || state.run) return;
    const todo = list.filter((u) => !state.kinds[u.pk]);
    if (!todo.length) return;
    state.checking = { total: todo.length, done: 0, stop: false };
    log('Conferindo o tipo de ' + todo.length + ' contas no Instagram, uma a cada poucos segundos…');
    renderBulk();
    try {
      for (const u of todo) {
        if (state.checking.stop) break;
        try {
          const r = await api.profileType(u.username);
          state.kinds[u.pk] = { kind: r.kind, category: r.category || '', source: 'perfil' };
          saveKinds();
          refreshCard(u);
        } catch (e) {
          if (e.kind === 'rate' || e.kind === 'blocked' || e.kind === 'auth') {
            log(e.message + ' Parei a conferência. Tente de novo mais tarde.', 'err');
            break;
          }
          log('Não consegui conferir @' + u.username + ' (' + e.message + ').', 'warn');
        }
        state.checking.done++;
        renderBulk();
        await sleep(DEMO ? 150 : rand(2500, 5000) + (state.checking.done % 25 === 0 ? rand(20000, 40000) : 0));
      }
    } finally {
      const done = state.checking.done;
      state.checking = null;
      log('Conferência terminada: ' + done + ' contas.', 'ok');
      renderStats();
      renderChips();
      renderBulk();
    }
  }

  function exportCsv() {
    if (!state.users.length) {
      log('Carregue a lista antes de exportar.', 'warn');
      return;
    }
    if (DEMO) {
      log('Na versão de verdade, este botão baixa uma planilha com todas as contas.', 'warn');
      return;
    }
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['usuario', 'nome', 'tipo', 'categoria', 'no_cofre', 'te_segue', 'verificado', 'privado', 'marcado', 'removido', 'link'].join(',')];
    for (const u of state.users) {
      lines.push([
        esc(u.username),
        esc(u.full_name),
        { pessoa: 'pessoa', pagina: 'pagina', '?': 'incerto' }[classify(u).kind],
        esc(classify(u).category),
        inVault(u) ? 'sim' : 'nao',
        state.followersLoaded ? (state.followers.has(u.pk) ? 'sim' : 'nao') : '',
        u.is_verified ? 'sim' : 'nao',
        u.is_private ? 'sim' : 'nao',
        state.selected.has(u.pk) ? 'sim' : 'nao',
        state.done.has(u.pk) ? 'sim' : 'nao',
        'https://www.instagram.com/' + u.username + '/',
      ].join(','));
    }
    saveFile('instagram-seguindo-' + today() + '.csv', '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
    log('Planilha exportada (' + state.users.length + ' contas).', 'ok');
  }

  function resetDemo() {
    if (state.run) return;
    Object.values(K).forEach((k) => store.del(k));
    location.reload();
  }

  function hide() {
    app.hidden = true;
    fab.hidden = false;
  }
  function show() {
    app.hidden = false;
    fab.hidden = true;
  }

  window.addEventListener('beforeunload', (e) => {
    if (state.run) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  window.__instaUnfollow = { show };

  // ---------- início ----------
  renderStats();
  renderGrid();
  renderQueue();
  if (DEMO) log('Demonstração pronta. Clique nos cartões para marcar quem sai.');
  else log('Pronto. Sessão detectada. Nenhuma senha é usada ou guardada.');
  if (!DEMO && state.users.length) log(state.users.length + ' contas salvas da última vez. Use "Atualizar lista" para buscar de novo.');
})();
