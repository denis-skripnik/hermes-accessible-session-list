import { host, PALETTE_AREA } from '@hermes/plugin-sdk';

export default {
  id: 'accessible-session-list',
  name: 'Accessible Session List',
  register(ctx) {
    const kind = new URLSearchParams(window.location.search).get('win');
    if (kind && kind !== 'session') return;
    ctx.i18n.register({en: {
      title: 'Session list', loading: 'Loading…', chats: 'Sessions',
      searchPlaceholder: 'Search by title', searchLabel: 'Search sessions',
      status: count => `Sessions: ${count}. Enter — open here; Shift+Enter — tab; Shift+F10 — menu. Tab — search and buttons.`,
      openError: error => `Could not open session: ${error}`,
      loadError: error => `Could not load sessions: ${error}`,
      actions: 'Session actions', inPlace: 'Open in primary area / existing tab',
      tab: 'Open in new / existing tab', close: 'Close'
    }, ru: {
      title: 'Список чатов', loading: 'Загрузка…', chats: 'Чаты',
      searchPlaceholder: 'Поиск по названию', searchLabel: 'Поиск чатов',
      status: count => `Чатов: ${count}. Enter — здесь; Shift+Enter — вкладка; Shift+F10 — меню. Tab — поиск и кнопки.`,
      openError: error => `Не удалось открыть чат: ${error}`,
      loadError: error => `Не удалось загрузить чаты: ${error}`,
      actions: 'Действия с чатом', inPlace: 'Открыть в основной области / существующей вкладке',
      tab: 'Открыть в новой / существующей вкладке', close: 'Закрыть'
    }});
    const t = (key, ...args) => ctx.i18n.t(key, ...args);
    let dialog = null;
    let generation = 0;
    let previous = null;
    const close = () => {
      generation++;
      dialog?.close();
      dialog?.remove();
      dialog = null;
      if (previous?.isConnected) previous.focus();
    };
    const open = async () => {
      if (dialog) return;
      previous = document.activeElement;
      const token = ++generation;
      dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', t('title'));
      dialog.style.cssText = 'width:min(720px,85vw);padding:20px;border:1px solid var(--ui-stroke-secondary);border-radius:12px;background:var(--ui-bg-elevated);color:var(--ui-text-primary);font:inherit';
      const title = document.createElement('h2'); title.textContent = t('title');
      const status = document.createElement('p'); status.setAttribute('role','status'); status.textContent = t('loading');
      const list = document.createElement('select'); list.size = 12; list.setAttribute('aria-label',t('chats'));
      list.style.cssText = 'width:100%;font:inherit;line-height:1.8;background:var(--ui-bg-elevated);color:var(--ui-text-primary);border:1px solid var(--ui-stroke-secondary)';
      let rows = [];
      const profile = host.state.profile.get();
      const search = document.createElement('input'); search.type='search'; search.placeholder=t('searchPlaceholder'); search.setAttribute('aria-label',t('searchLabel')); search.style.cssText='display:block;width:100%;box-sizing:border-box;margin-bottom:10px;font:inherit';
      const filter = () => {
        const selected = list.value;
        list.replaceChildren();
        const query = search.value.trim().toLocaleLowerCase();
        for(const row of rows.filter(row=>(row.title || row.id).toLocaleLowerCase().includes(query))) {
          const option=document.createElement('option');option.value=row.id;option.textContent=row.title || row.id;list.append(option);
        }
        const index = Array.from(list.options).findIndex(option=>option.value===selected);
        list.selectedIndex=index>=0?index:(list.options.length?0:-1);
        status.textContent=t('status',list.options.length);
      };
      search.addEventListener('input',filter);
      search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();list.focus();}});
      const activate = async intent => {
        if (!list.value) return;
        const id = list.value;
        close();
        try { await host.openSession(id,{profile,intent}); }
        catch(error) { host.notify({kind:'error',message:t('openError',error.message || String(error))}); }
      };
      let menu = null;
      const hideMenu = () => {menu?.remove();menu=null;list.focus();};
      const showMenu = e => {
        e.preventDefault(); e.stopPropagation();
        if(!list.value) return;
        menu?.remove(); menu=document.createElement('div');menu.setAttribute('role','menu');menu.setAttribute('aria-label',t('actions'));
        menu.style.cssText='padding:10px;border:1px solid var(--ui-stroke-secondary);display:flex;gap:8px';
        for(const [label,intent] of [[t('inPlace'),'in-place'],[t('tab'),'tab']]) {
          const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=label;button.onclick=()=>void activate(intent);menu.append(button);
        }
        menu.addEventListener('keydown',event=>{
          const buttons=Array.from(menu.children);const index=buttons.indexOf(document.activeElement);
          if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();}
          else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hideMenu();}
          else if(event.key==='Enter'||event.key===' '){event.preventDefault();document.activeElement.click();}
          else if(event.key==='Tab'){event.preventDefault();hideMenu();}
        });
        dialog.append(menu);menu.firstElementChild.focus();
      };
      list.addEventListener('contextmenu',showMenu);
      list.addEventListener('keydown',e=>{
        if(e.key==='ContextMenu'||(e.key==='F10'&&e.shiftKey)) showMenu(e);
        else if(e.key==='Enter') { e.preventDefault();e.stopPropagation();void activate(e.shiftKey?'tab':'in-place'); }
      });
      list.addEventListener('dblclick',()=>void activate('in-place'));
      const actions=document.createElement('button');actions.type='button';actions.textContent=t('actions');actions.onclick=showMenu;
      const cancel = document.createElement('button'); cancel.textContent = t('close'); cancel.onclick = close;
      dialog.append(title,search,status,list,actions,cancel);
      dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
      dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
      document.body.append(dialog); dialog.showModal(); list.focus();
      try {
        const result = await host.listPersistedSessions(null,{profile,limit:500});
        if (token !== generation) return;
        // Match the sidebar activity key, not this SDK endpoint's creation order.
        // Filter by provenance, never by title language or the local-* id prefix.
        const visible = (result.sessions || []).filter(row =>
          typeof row.id === 'string' && !row.hidden && !row.archived && !row.is_internal_child &&
          !['tool','subagent','cron'].includes(row.source) &&
          !(row.message_count === 0 && !row.title?.trim())
        );
        rows = Array.from(new Map(visible.map(row=>[row.id,row])).values())
          .sort((a,b)=>(b.last_active || b.started_at || 0)-(a.last_active || a.started_at || 0));
        filter();
      } catch(error) {
        if(token === generation) status.textContent = t('loadError',error.message || String(error));
      }
    };
    const shortcut = e => {
      if(e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
        e.preventDefault(); e.stopImmediatePropagation(); void open();
      }
    };
    // Core may handle Ctrl+H first. This listener cannot override that conflict.
    // No core shortcut storage or event prototypes are changed.
    window.addEventListener('keydown',shortcut,true);
    ctx.register({id:'open',area:PALETTE_AREA,data:{id:'accessible-session-list.open',label:t('title'),run:()=>void open()}});
    ctx.onDispose(()=>{window.removeEventListener('keydown',shortcut,true);close();});
  }
};
