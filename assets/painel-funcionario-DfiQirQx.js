import"./modulepreload-polyfill-Dezn_h7o.js";window.location.hostname;var e=io({query:{token:localStorage.getItem(`chef_token`),restaurante_id:localStorage.getItem(`restaurante_id`)||`1`}});function t(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}var n=document.getElementById(`login-view`),r=document.getElementById(`dashboard-view`);setInterval(()=>{let e=new Date;document.getElementById(`current-time`).innerText=e.toLocaleTimeString(`pt-BR`)},1e3);var i=null,a=`fora`,o={pontos:[],consumo:[]},s=new Date().getMonth(),c=new Date().getFullYear(),l={};localStorage.removeItem(`chef_credentials`);var u=localStorage.getItem(`chef_session`);if(u)try{let t=JSON.parse(u);t.token&&e.emit(`login_funcionario_token`,t.token)}catch{}document.getElementById(`btn-login`).onclick=()=>{let t=document.getElementById(`login-user`).value,n=document.getElementById(`login-pass`).value;if(!t||!n)return alert(`Preencha os dados`);e.emit(`login_funcionario`,{usuario:t,senha:n})},e.on(`login_error`,e=>{localStorage.removeItem(`chef_credentials`),localStorage.removeItem(`chef_session`),alert(e)}),e.on(`login_success`,t=>{i=t,n.style.display=`none`,r.style.display=`flex`,document.getElementById(`user-name`).innerText=t.nome.split(` `)[0],document.getElementById(`user-role`).innerText=t.cargo;let a=document.getElementById(`btn-access-system`);a.onclick=()=>{if([`Admin`,`Administrador`,`adm`,`Gerente`].includes(t.cargo)){C();return}t.cargo===`Garçom`?window.location.href=`/garcom.html`:t.cargo===`Caixa`?window.location.href=`/index.html`:window.location.href=`/fila-pedidos.html`},[`Admin`,`Administrador`,`adm`,`Gerente`].includes(t.cargo)&&(document.getElementById(`btn-manager-toggle`).style.display=``,document.getElementById(`btn-manager-toggle`).onclick=()=>{let e=document.getElementById(`manager-panel`);if(e.style.display===`flex`){e.style.display=`none`;return}e.style.display=`flex`,w()},document.getElementById(`btn-manager-close`).onclick=()=>{document.getElementById(`manager-panel`).style.display=`none`}),e.emit(`get_metricas_funcionario`,t.id)}),e.on(`login_token`,e=>{if(!(!e||!i))try{localStorage.setItem(`chef_session`,JSON.stringify({token:e,usuario:i.usuario,cargo:i.cargo,nome:i.nome,id:i.id}))}catch{}}),document.getElementById(`btn-logout`).onclick=()=>{localStorage.removeItem(`chef_credentials`),localStorage.removeItem(`chef_session`),localStorage.removeItem(`logged_user`),window.location.href=`/ativacao.html`};var d=document.getElementById(`btn-ponto`),f=document.getElementById(`work-status`);d.onclick=()=>{i&&v(a===`fora`?`entrada`:`saida`)},e.on(`ponto_registrado`,({acao:t})=>{alert(t===`entrada`?`Entrada registrada com sucesso!`:`Saída registrada com sucesso! Seu turno foi encerrado.`),e.emit(`get_metricas_funcionario`,i.id)}),e.on(`metricas_funcionario_response`,({pontos:n,vales:r,pagamentos:o})=>{let s=n[0];s&&!s.saida?(a=`trabalhando`,d.className=`btn-main btn-danger`,d.innerHTML=`<i class="ph ph-fingerprint" style="margin-right: 8px;"></i> REGISTRAR SAÍDA`,f.innerText=`Turno em andamento (Entrada: `+new Date(s.entrada).toLocaleTimeString(`pt-BR`)+`)`):(a=`fora`,d.className=`btn-main btn-success`,d.innerHTML=`<i class="ph ph-fingerprint" style="margin-right: 8px;"></i> REGISTRAR ENTRADA`,f.innerText=`Pronto para iniciar seu turno?`);let c=new Date().getMonth(),l=0,u=0,p=new Set;n.forEach(e=>{new Date(e.entrada).getMonth()===c&&(e.total_horas&&(l+=e.total_horas),e.valor_pagar&&(u+=e.valor_pagar),p.add(e.data))}),document.getElementById(`metric-horas`).innerText=l.toFixed(1)+`h`,document.getElementById(`metric-valor`).innerText=`R$ `+u.toFixed(2).replace(`.`,`,`),document.getElementById(`metric-dias`).innerText=p.size;let m=p.size>0?(l/p.size).toFixed(1):0;document.getElementById(`metric-media`).innerText=m+`h`;let h=document.getElementById(`vales-list`);if(r.length===0)h.innerHTML=`<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum vale solicitado.</div>`;else{let e=``;r.forEach(n=>{let r=n.status.toLowerCase();r=r===`pendente`?`pendente`:r===`aprovado`?`aprovado`:`recusado`,e+=`
        <div class="vale-item">
          <div class="vale-info">
            <strong>R$ ${n.valor.toFixed(2).replace(`.`,`,`)}</strong>
            <span>${new Date(n.data_pedido).toLocaleDateString(`pt-BR`)}</span>
          </div>
          <span class="status-badge ${r}">${t(n.status)}</span>
        </div>
      `}),h.innerHTML=e}let g=document.getElementById(`pagamentos-list`);if(!o||o.length===0)g.innerHTML=`<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum pagamento registrado.</div>`;else{let e=``;o.forEach(n=>{let r=n.data_pagamento?new Date(n.data_pagamento).toLocaleDateString(`pt-BR`):`-`,i=parseFloat(n.valor_liquido||n.valor_bruto||0);e+=`
        <div class="pagamento-item" onclick="window.verDetalhePagamento(${JSON.stringify(n).replace(/"/g,`&quot;`)})">
          <div class="pagamento-info">
            <strong>${t(n.observacao||`Pagamento`)}</strong>
            <span>${r}</span>
          </div>
          <div class="pagamento-valor">R$ ${i.toFixed(2).replace(`.`,`,`)}</div>
        </div>
      `}),g.innerHTML=e}i&&(b(),e.emit(`get_meu_consumo`,i.id))}),e.on(`restaurante_config`,e=>{l=e}),e.emit(`get_restaurante_config`),document.getElementById(`btn-close-pgto-detalhe`).onclick=()=>{document.getElementById(`modal-pagamento-detalhe`).style.display=`none`},window.verDetalhePagamento=function(e){let n=e.data_pagamento?new Date(e.data_pagamento).toLocaleDateString(`pt-BR`,{day:`2-digit`,month:`long`,year:`numeric`}):`-`,r=parseFloat(e.valor_bruto||0),i=parseFloat(e.total_vales_abatidos||0),a=parseFloat(e.total_consumo_abatido||0),o=parseFloat(e.valor_liquido||0);document.getElementById(`pgto-detalhe-content`).innerHTML=`
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px;">
      <div style="font-size: 14px; color: #166534;">Valor Recebido</div>
      <div style="font-size: 32px; font-weight: 900; color: #16a34a;">R$ ${o.toFixed(2).replace(`.`,`,`)}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Data</span>
        <span style="font-weight: 600;">${n}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Valor Bruto</span>
        <span style="font-weight: 600;">R$ ${r.toFixed(2).replace(`.`,`,`)}</span>
      </div>
      ${i>0?`<div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #fff1f2; border-radius: 8px;">
        <span style="color: #e11d48;">Vales Abatidos</span>
        <span style="font-weight: 600; color: #e11d48;">- R$ ${i.toFixed(2).replace(`.`,`,`)}</span>
      </div>`:``}
      ${a>0?`<div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #fff7ed; border-radius: 8px;">
        <span style="color: #ea580c;">Consumo Abatido</span>
        <span style="font-weight: 600; color: #ea580c;">- R$ ${a.toFixed(2).replace(`.`,`,`)}</span>
      </div>`:``}
      ${e.observacao?`<div style="padding: 10px 12px; background: #f8f9fa; border-radius: 8px;">
        <span style="color: #64748b;">Observação: </span>
        <span style="font-weight: 500;">${t(e.observacao)}</span>
      </div>`:``}
    </div>
  `,document.getElementById(`modal-pagamento-detalhe`).style.display=`flex`};function p(){let e=document.getElementById(`confetti-canvas`);if(!e)return;let t=e.getContext(`2d`);e.width=window.innerWidth,e.height=window.innerHeight;let n=[`#6c5ce7`,`#a29bfe`,`#00b894`,`#fdcb6e`,`#e17055`,`#ff7675`,`#74b9ff`,`#55efc4`,`#fd79a8`],r=[];for(let t=0;t<120;t++)r.push({x:Math.random()*e.width,y:Math.random()*e.height-e.height,w:Math.random()*10+5,h:Math.random()*6+3,color:n[Math.floor(Math.random()*n.length)],vx:(Math.random()-.5)*4,vy:Math.random()*3+2,rot:Math.random()*360,rotSpeed:(Math.random()-.5)*10,opacity:1});let i=0;function a(){t.clearRect(0,0,e.width,e.height);let n=!1;r.forEach(r=>{r.x+=r.vx,r.y+=r.vy,r.vy+=.05,r.rot+=r.rotSpeed,i>60&&(r.opacity-=.015),r.opacity>0&&r.y<e.height+50&&(n=!0,t.save(),t.translate(r.x,r.y),t.rotate(r.rot*Math.PI/180),t.globalAlpha=Math.max(0,r.opacity),t.fillStyle=r.color,t.fillRect(-r.w/2,-r.h/2,r.w,r.h),t.restore())}),i++,n?requestAnimationFrame(a):t.clearRect(0,0,e.width,e.height)}a()}function m(){try{let e=new(window.AudioContext||window.webkitAudioContext),t=[523.25,659.25,783.99,1046.5,783.99,1046.5],n=[.12,.12,.12,.2,.12,.3],r=e.currentTime;t.forEach((t,i)=>{let a=e.createOscillator(),o=e.createGain();a.type=`sine`,a.frequency.value=t,o.gain.setValueAtTime(.3,r),o.gain.exponentialRampToValueAtTime(.001,r+n[i]+.05),a.connect(o),o.connect(e.destination),a.start(r),a.stop(r+n[i]+.05),r+=n[i]})}catch{}}function h(e){if(i&&e.funcionario_id!==i.id)return;let t=document.getElementById(`celebration-overlay`);document.getElementById(`celebration-name`).textContent=e.funcionario_nome,document.getElementById(`celebration-value`).textContent=`R$ `+parseFloat(e.valor).toFixed(2).replace(`.`,`,`),document.getElementById(`celebration-obs`).textContent=e.observacao||``,t.style.display=`flex`,p(),m(),setTimeout(()=>{t.style.display=`none`},8e3)}e.on(`pagamento_colaborador_celebracao`,t=>{h(t),i&&e.emit(`get_metricas_funcionario`,i.id)});var g=document.getElementById(`modal-vale`);document.getElementById(`btn-solicitar-vale`).onclick=()=>g.style.display=`flex`,document.getElementById(`btn-close-vale`).onclick=()=>g.style.display=`none`,document.getElementById(`btn-confirm-vale`).onclick=()=>{let t=parseFloat(document.getElementById(`vale-valor`).value);if(!t||t<=0)return alert(`Insira um valor válido`);e.emit(`solicitar_vale`,{funcionario_id:i.id,valor:t}),g.style.display=`none`,document.getElementById(`vale-valor`).value=``},e.on(`vale_solicitado_success`,()=>{alert(`Vale solicitado com sucesso!`),e.emit(`get_metricas_funcionario`,i.id)}),e.on(`bater_ponto_error`,e=>{alert(e)});var _=null;window.fecharScannerPonto=function(){document.getElementById(`modal-qr-scanner`).style.display=`none`,_&&_.stop().then(()=>{_.clear(),_=null}).catch(e=>console.error(`Falha ao parar scanner`,e))};function v(t){let n=document.getElementById(`modal-qr-scanner`);if(typeof Html5Qrcode>`u`){n&&(n.style.display=`none`),alert(`Leitor de QR indisponível (biblioteca não carregada).`);return}n&&(n.style.display=`flex`),_||(_=new Html5Qrcode(`qr-reader`)),_.start({facingMode:`environment`},{fps:10,qrbox:{width:250,height:250}},(n,r)=>{try{let r=new URL(n).searchParams.get(`t`);r?(fecharScannerPonto(),e.emit(`bater_ponto`,{funcionario_id:i.id,acao:t,token:r})):(fecharScannerPonto(),alert(`QR Code inválido. Token não encontrado.`))}catch{fecharScannerPonto(),alert(`QR Code não reconhecido. Certifique-se de escanear o código correto.`)}},e=>{}).catch(e=>{alert(`Erro ao acessar a câmera. Verifique se deu permissão ao navegador.`),fecharScannerPonto()})}var y=null;window.fecharScannerConsumo=function(){document.getElementById(`modal-consumo-scanner`).style.display=`none`,y&&y.stop().then(()=>{y.clear(),y=null}).catch(e=>console.error(`Falha ao parar scanner consumo`,e))},window.abrirScannerBarcode=function(e){document.getElementById(`modal-consumo-scanner`).style.display=`flex`,y||(y=new Html5Qrcode(`consumo-qr-reader`,{formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.CODE_93,Html5QrcodeSupportedFormats.ITF]})),y.start({facingMode:`environment`},{fps:10,qrbox:{width:250,height:250}},(t,n)=>{fecharScannerConsumo(),e&&e(t)},e=>{}).catch(e=>{alert(`Erro ao acessar a câmera. Verifique se deu permissão ao navegador.`),fecharScannerConsumo()})},window.abrirScannerConsumo=function(){abrirScannerBarcode(function(e){let t=document.getElementById(`consumo-barcode`);t&&(t.value=e),buscarProdutoBarcodeConsumo()})},window.abrirScannerEstoque=function(){abrirScannerBarcode(function(e){let t=document.getElementById(`mgr-estq-barcode`);t&&(t.value=e),buscarProdutoPorBarcode()})},document.getElementById(`btn-meu-consumo`).onclick=()=>{document.getElementById(`modal-consumo`).style.display=`flex`,document.getElementById(`consumo-barcode`).value=``,e.emit(`get_cardapio_funcionario`)},document.getElementById(`btn-close-consumo`).onclick=()=>{document.getElementById(`modal-consumo`).style.display=`none`},e.on(`cardapio_funcionario`,e=>{let n=document.getElementById(`cardapio-funcionario`);if(!e||e.length===0){n.innerHTML=`<div style="padding:20px;text-align:center;color:var(--text-muted);">Nenhum item disponível.</div>`;return}let r=``;e.forEach(e=>{let n=e.preco||0;e.preco_fixo?n=e.preco_fixo:e.desconto_percentual&&(n*=1-e.desconto_percentual/100),r+=`
      <div class="cardapio-item">
        <div class="cardapio-item-info">
          <span class="cardapio-item-emoji">${t(e.emoji||`🍽️`)}</span>
          <div>
            <div class="cardapio-item-nome">${t(e.nome)}</div>
            <div class="cardapio-item-preco">R$ ${n.toFixed(2).replace(`.`,`,`)}</div>
          </div>
        </div>
        <button class="cardapio-item-add" onclick="adicionarConsumo(${e.id})">+</button>
      </div>
    `}),n.innerHTML=r}),window.adicionarConsumo=function(t){i&&e.emit(`adicionar_consumo_funcionario`,{funcionario_id:i.id,produto_id:t,quantidade:1})},window.buscarProdutoBarcodeConsumo=function(){let n=document.getElementById(`consumo-barcode`),r=n?n.value.trim():``;r&&(e.emit(`get_produto_by_barcode`,r),e.once(`produto_by_barcode_result`,r=>{if(!r){alert(`Produto não encontrado para o código de barras informado.`);return}adicionarConsumo(r.id),n.value=``;let i=document.getElementById(`cardapio-funcionario`);i.innerHTML=`<div style="padding:20px;text-align:center;color:#16a34a;font-weight:600;">✓ ${t(r.nome)} adicionado ao consumo!</div>`,setTimeout(()=>e.emit(`get_cardapio_funcionario`),800)}))},e.on(`consumo_adicionado`,t=>{document.getElementById(`modal-consumo`).style.display=`none`,e.emit(`get_meu_consumo`,i.id),b()}),e.on(`consumo_erro`,e=>{alert(e)}),window.filtrarCardapio=function(e){let t=e.toLowerCase();document.querySelectorAll(`.cardapio-item`).forEach(e=>{let n=e.querySelector(`.cardapio-item-nome`).innerText.toLowerCase();e.style.display=n.includes(t)?`flex`:`none`})},e.on(`meu_consumo`,e=>{let n=document.getElementById(`consumo-list`);if(!e||e.length===0){n.innerHTML=`<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum consumo registrado.</div>`;return}let r=``,i=0;e.forEach(e=>{let n=parseFloat(e.total||0);i+=n,r+=`
      <div class="consumo-item">
        <div>
          <div class="consumo-nome">${t(e.productName)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${new Date(e.createdAt).toLocaleDateString(`pt-BR`)}</div>
        </div>
        <div class="consumo-total">- R$ ${n.toFixed(2).replace(`.`,`,`)}</div>
      </div>
    `}),r+=`
    <div class="consumo-item" style="background:#fff3cd;">
      <div class="consumo-nome" style="font-weight:700;">Total a Pagar</div>
      <div style="font-weight:800;color:#dc2626;">R$ ${i.toFixed(2).replace(`.`,`,`)}</div>
    </div>
  `,n.innerHTML=r});function b(){i&&e.emit(`get_calendario_funcionario`,i.id)}e.on(`calendario_funcionario`,e=>{o=e,x()});function x(){let e=document.getElementById(`calendario-view`),t=s,n=c;document.getElementById(`cal-mes-label`).innerText=new Date(n,t).toLocaleDateString(`pt-BR`,{month:`long`,year:`numeric`});let r=new Date(n,t,1).getDay(),i=new Date(n,t+1,0).getDate(),a=new Date,u=`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,`0`)}-${String(a.getDate()).padStart(2,`0`)}`,d=o.data_cadastro?String(o.data_cadastro).split(` `)[0]:``,f=[0,3,4,5,6];try{let e=l.rest_dias_funcionamento;if(e){let t=JSON.parse(e);Array.isArray(t)&&t.length>0&&(f=t)}}catch{}function p(e){let r=new Date(n,t,e).getDay();return f.includes(r)}let m={};(o.pontos||[]).forEach(e=>{let t=e.data?e.data.split(` `)[0]:``;m[t]=e});let h={};(o.consumo||[]).forEach(e=>{let t=e.createdAt?e.createdAt.split(` `)[0]:``;h[t]||(h[t]=0),h[t]+=parseFloat(e.total||0)});let g={};(o.atipicos||[]).forEach(e=>{let t=e.data?e.data.split(` `)[0]:``;g[t]||(g[t]=[]),g[t].push(e)});let _=`<div class="cal-grid">`;[`Dom`,`Seg`,`Ter`,`Qua`,`Qui`,`Sex`,`Sáb`].forEach(e=>{_+=`<div class="cal-header">${e}</div>`});for(let e=0;e<r;e++)_+=`<div></div>`;for(let e=1;e<=i;e++){let r=`${n}-${String(t+1).padStart(2,`0`)}-${String(e).padStart(2,`0`)}`,i=m[r],a=g[r]||[],o=r===u,s=!!i,c=p(e)&&r<u&&!s&&a.length===0&&(!d||r>=d),l=`cal-day`;s?l+=` worked`:c?l+=` falta`:a.some(e=>e.status===`aprovado`)?l+=` atipico-aprovado`:a.length>0&&(l+=` atipico`),o&&(l+=` today`);let f=i&&i.total_horas||0,h=``;c?h=`<div class="cal-horas" style="color:#dc3545;">Falta</div>`:a.length>0?h=`<div class="cal-horas" style="color:#6c2c8a;">Extra R$ ${a.reduce((e,t)=>e+parseFloat(t.valor||0),0).toFixed(0)}</div>`:f>0&&(h=`<div class="cal-horas">${f.toFixed(1)}h</div>`),_+=`
      <div class="${l}" onclick="selectCalDay('${r}')">
        <div>${e}</div>
        ${h}
      </div>
    `}_+=`</div>`;let v=0,y=0,b=0,x=0,S=0;(o.pontos||[]).forEach(e=>{e.data&&e.data.startsWith(`${n}-${String(t+1).padStart(2,`0`)}`)&&(v+=parseFloat(e.total_horas||0),y+=parseFloat(e.valor_pagar||0),b++)});for(let e=1;e<=i;e++){let r=`${n}-${String(t+1).padStart(2,`0`)}-${String(e).padStart(2,`0`)}`;r>=u||r<d||p(e)&&!m[r]&&(!g[r]||g[r].length===0)&&x++}let C=0;Object.values(h).forEach(e=>C+=e),(o.atipicos||[]).forEach(e=>{e.data&&e.data.startsWith(`${n}-${String(t+1).padStart(2,`0`)}`)&&e.status===`aprovado`&&(S+=parseFloat(e.valor||0))}),_+=`
    <div class="cal-summary visible" style="margin-top:16px;">
      <div style="font-weight:600;margin-bottom:8px;">Resumo do Mês</div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Dias Trabalhados</span>
        <span class="cal-summary-value">${b}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Faltas</span>
        <span class="cal-summary-value" style="color:#dc3545;">${x}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Total Horas</span>
        <span class="cal-summary-value">${v.toFixed(1)}h</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Valor Bruto</span>
        <span class="cal-summary-value">R$ ${y.toFixed(2).replace(`.`,`,`)}</span>
      </div>
      ${S>0?`<div class="cal-summary-row">
        <span class="cal-summary-label">Dias Extras (Aprovados)</span>
        <span class="cal-summary-value" style="color:#7c3aed;">R$ ${S.toFixed(2).replace(`.`,`,`)}</span>
      </div>`:``}
      <div class="cal-summary-row">
        <span class="cal-summary-label">Consumo (Fiado)</span>
        <span class="cal-summary-value" style="color:#dc2626;">R$ ${C.toFixed(2).replace(`.`,`,`)}</span>
      </div>
    </div>
  `,e.innerHTML=_}window.selectCalDay=function(e){x();let n=(o.pontos||[]).find(t=>t.data&&t.data.startsWith(e)),r=(o.consumo||[]).filter(t=>t.createdAt&&t.createdAt.startsWith(e)),i=(o.atipicos||[]).filter(t=>t.data&&t.data.startsWith(e)),a=document.getElementById(`calendario-view`),s=`
    <div class="cal-summary visible" style="margin-top:12px;border:2px solid var(--primary);">
      <div style="font-weight:600;margin-bottom:8px;">${new Date(e+`T12:00:00`).toLocaleDateString(`pt-BR`,{weekday:`long`,day:`2-digit`,month:`long`})}</div>
  `;n?s+=`
      <div class="cal-summary-row">
        <span class="cal-summary-label">Entrada</span>
        <span class="cal-summary-value">${n.entrada?new Date(n.entrada).toLocaleTimeString(`pt-BR`):`-`}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Saída</span>
        <span class="cal-summary-value">${n.saida?new Date(n.saida).toLocaleTimeString(`pt-BR`):`Em andamento`}</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Horas</span>
        <span class="cal-summary-value">${(n.total_horas||0).toFixed(1)}h</span>
      </div>
      <div class="cal-summary-row">
        <span class="cal-summary-label">Valor</span>
        <span class="cal-summary-value">R$ ${(n.valor_pagar||0).toFixed(2).replace(`.`,`,`)}</span>
      </div>
    `:s+=`<div style="padding:12px;text-align:center;color:var(--text-muted);">Nenhum ponto registrado neste dia.</div>`,i.length>0&&(s+=`<div style="margin-top:8px;font-weight:600;color:#7c3aed;">Convocação Extra</div>`,i.forEach(e=>{let n=e.status===`aprovado`?`✅ Aceito`:e.status===`recusado`?`❌ Recusado`:`⏳ Pendente`,r=e.status===`pendente`;s+=`
        <div class="cal-summary-row" style="flex-wrap:wrap;">
          <span class="cal-summary-label">${t(e.justificativa||`Dia Extra`)} <span style="font-size:11px;color:#94a3b8;">${n}</span></span>
          <span class="cal-summary-value" style="color:#7c3aed;">R$ ${parseFloat(e.valor||0).toFixed(2).replace(`.`,`,`)}</span>
        </div>
        ${r?`
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button onclick="responderAtipico(${e.id},'aceitar')" style="flex:1;padding:8px;background:#16a34a;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">✅ Aceitar</button>
          <button onclick="responderAtipico(${e.id},'recusar')" style="flex:1;padding:8px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">❌ Recusar</button>
        </div>`:``}
      `})),r.length>0&&(s+=`<div style="margin-top:8px;font-weight:600;">Consumo do Dia</div>`,r.forEach(e=>{s+=`
        <div class="cal-summary-row">
          <span class="cal-summary-label">${t(e.productName)}</span>
          <span class="cal-summary-value" style="color:#dc2626;">R$ ${parseFloat(e.total||0).toFixed(2).replace(`.`,`,`)}</span>
        </div>
      `})),s+=`</div>`,a.insertAdjacentHTML(`beforeend`,s)},document.getElementById(`btn-cal-mes-menor`).onclick=()=>{s--,s<0&&(s=11,c--),x()},document.getElementById(`btn-cal-mes-maior`).onclick=()=>{s++,s>11&&(s=0,c++),x()},window.responderAtipico=function(t,n){i&&e.emit(`responder_dia_atipico`,{id:t,acao:n})},e.on(`dia_atipico_atualizado`,()=>{b()});var S=document.getElementById(`btn-solicitar-dia-extra`);S&&(S.style.display=`none`);function C(){let e=document.getElementById(`manager-system-picker-overlay`);e&&e.remove();let t=document.createElement(`div`);t.id=`manager-system-picker-overlay`,t.style.cssText=`position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;`;let n=document.createElement(`div`);n.style.cssText=`background:white;border-radius:20px;padding:24px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);`,n.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;font-size:18px;"><i class="ph ph-desktop"></i> Acessar Sistema</h3>
      <button id="picker-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;"><i class="ph ph-x"></i></button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${[{label:`PDV / Caixa`,icon:`ph ph-currency-circle-dollar`,href:`/index.html`,desc:`Sistema principal de vendas e mesas`},{label:`Garçom`,icon:`ph ph-note-pencil`,href:`/garcom.html`,desc:`Comandas e pedidos para garçons`},{label:`Fila de Pedidos`,icon:`ph ph-list-bullets`,href:`/fila-pedidos.html`,desc:`Visualização da fila de produção`},{label:`Cardápio Digital`,icon:`ph ph-qr-code`,href:`/cardapio.html`,desc:`Cardápio online para clientes`}].map(e=>`
        <button onclick="window.location.href='${e.href}'" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:12px;cursor:pointer;text-align:left;transition:background 0.15s;width:100%;font-family:inherit;font-size:inherit;">
          <i class="${e.icon}" style="font-size:24px;color:#9b59b6;width:32px;text-align:center;"></i>
          <div style="flex:1;">
            <div style="font-weight:600;color:#2c3e50;font-size:15px;">${e.label}</div>
            <div style="font-size:12px;color:#7f8c8d;margin-top:2px;">${e.desc}</div>
          </div>
          <i class="ph ph-caret-right" style="color:#adb5bd;"></i>
        </button>
      `).join(``)}
    </div>
  `,t.appendChild(n),document.body.appendChild(t),document.getElementById(`picker-close-btn`).onclick=()=>t.remove(),t.addEventListener(`click`,e=>{e.target===t&&t.remove()})}async function w(){let t=document.getElementById(`manager-team-status`),n=document.getElementById(`manager-vales-pendentes`);t.innerHTML=`Carregando...`,n.innerHTML=`Carregando...`,e.emit(`manager_get_team_status`),e.emit(`manager_get_pending_vales`)}e.on(`manager_team_status`,e=>{let n=document.getElementById(`manager-team-status`);if(!n)return;let r=0,i=0,a=0;e.forEach(e=>{e.online&&r++,e.online||i++,e.ponto_aberto&&a++}),n.innerHTML=`
    <div style="display:flex; gap:16px; flex-wrap:wrap;">
      <span><strong>${e.length}</strong> total</span>
      <span style="color:#4ade80;"><strong>${r}</strong> online</span>
      <span style="color:#94a3b8;"><strong>${i}</strong> offline</span>
      <span style="color:#facc15;"><strong>${a}</strong> em ponto</span>
    </div>
    <div style="margin-top:6px; max-height:120px; overflow-y:auto;">
      ${e.map(e=>`
        <div style="display:flex; justify-content:space-between; padding:2px 0; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span>${t(e.nome)}</span>
          <span>${e.ponto_aberto?`<i class="ph ph-clock"></i>`:e.online?`<span style="color:#4ade80;">online</span>`:`<span style="opacity:0.5;">offline</span>`}</span>
        </div>
      `).join(``)}
    </div>
  `}),e.on(`manager_pending_vales`,e=>{let n=document.getElementById(`manager-vales-pendentes`),r=document.getElementById(`manager-pending-count`);if(n){if(r.textContent=e.length,!e.length){n.innerHTML=`Nenhum vale pendente.`;return}n.innerHTML=e.map(e=>`
    <div class="vales-pendentes-item">
      <div class="vp-info">
        <strong>${t(e.funcionario_nome)}</strong><br>
        <span>R$ ${parseFloat(e.valor).toFixed(2)}</span>
        <span style="opacity:0.6; font-size:11px;"> — ${t(e.motivo||`sem motivo`)}</span>
      </div>
      <div class="vp-actions">
        <button class="vp-aprovar" onclick="managerAprovarVale(${e.id}, this)">Aprovar</button>
        <button class="vp-recusar" onclick="managerRecusarVale(${e.id}, this)">Recusar</button>
      </div>
    </div>
  `).join(``)}}),window.managerAprovarVale=function(t,n){n.disabled=!0,n.textContent=`...`,e.emit(`manager_aprovar_vale`,{id:t})},window.managerRecusarVale=function(t,n){n.disabled=!0,n.textContent=`...`,e.emit(`manager_recusar_vale`,{id:t})},e.on(`manager_vale_atualizado`,e=>{w()}),window.fecharModal=function(e){let t=document.getElementById(e);t&&(t.style.display=`none`)};function T(n){e.emit(`get_funcionarios`),e.once(`funcionarios_atualizados`,e=>{let r=document.getElementById(n);r&&(r.innerHTML=`<option value="">Selecione...</option>`+(e||[]).filter(e=>e.status===`Ativo`).map(e=>`<option value="${e.id}">${t(e.nome)} (${t(e.cargo||``)})</option>`).join(``))})}window.openModalLancarVale=function(){document.getElementById(`modal-mgr-vale`).style.display=`flex`,document.getElementById(`mgr-vale-valor`).value=``,document.getElementById(`mgr-vale-motivo`).value=``,T(`mgr-vale-func`)},window.confirmarLancarVale=function(){let t=document.getElementById(`mgr-vale-func`).value,n=parseFloat(document.getElementById(`mgr-vale-valor`).value),r=document.getElementById(`mgr-vale-motivo`).value||``;if(!t)return alert(`Selecione um colaborador.`);if(!n||n<=0)return alert(`Informe um valor válido.`);e.emit(`solicitar_vale`,{funcionario_id:parseInt(t),valor:n,motivo:r}),e.once(`vale_solicitado_success`,()=>{fecharModal(`modal-mgr-vale`),alert(`Vale concedido com sucesso!`),w()}),e.once(`solicitar_vale_error`,e=>alert(e||`Erro ao conceder vale.`))},window.openModalFazerPagamento=function(){document.getElementById(`modal-mgr-pagamento`).style.display=`flex`,document.getElementById(`mgr-pgto-extrato`).style.display=`none`,document.getElementById(`mgr-pgto-bruto`).value=``,document.getElementById(`mgr-pgto-obs`).value=``,document.getElementById(`mgr-pgto-liquido`).textContent=`R$ 0,00`,T(`mgr-pgto-func`)},window.carregarExtratoPagamento=function(){let e=document.getElementById(`mgr-pgto-func`).value,n=document.getElementById(`mgr-pgto-extrato`);if(!e){n.style.display=`none`;return}n.style.display=`block`,document.getElementById(`mgr-pgto-vales-abater`).innerHTML=`Carregando...`,document.getElementById(`mgr-pgto-consumo-abater`).innerHTML=``,fetch(`/api/rh/extrato/${e}`).then(e=>e.json()).then(e=>{let n=(e.vales||[]).map(e=>`<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #eee;">
          <span>Vale #${e.id}</span>
          <span style="color:#dc2626;">-R$ ${parseFloat(e.valor).toFixed(2)}</span>
        </div>`).join(``)||`<span style="opacity:0.7;">Nenhum vale pendente</span>`;document.getElementById(`mgr-pgto-vales-abater`).innerHTML=`<strong style="font-size:12px;">Vales a Abater:</strong> <span style="font-size:12px;color:#dc2626;">R$ ${(e.total_vales||0).toFixed(2)}</span>${n?`<br>`+n:``}`;let r=(e.fiados||[]).map(e=>`<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #eee;">
          <span>${t(e.productName)} x${e.quantity}</span>
          <span style="color:#dc2626;">-R$ ${parseFloat(e.total).toFixed(2)}</span>
        </div>`).join(``)||`<span style="opacity:0.7;">Nenhum consumo pendente</span>`;document.getElementById(`mgr-pgto-consumo-abater`).innerHTML=`<strong style="font-size:12px;">Consumo a Abater:</strong> <span style="font-size:12px;color:#dc2626;">R$ ${(e.total_consumo||0).toFixed(2)}</span>${r?`<br>`+r:``}`,e.suggested_bruto&&(document.getElementById(`mgr-pgto-bruto`).value=e.suggested_bruto.toFixed(2),calcularLiquidoPagamento())}).catch(()=>{document.getElementById(`mgr-pgto-vales-abater`).innerHTML=`Erro ao carregar extrato.`})},window.calcularLiquidoPagamento=function(){let e=parseFloat(document.getElementById(`mgr-pgto-bruto`).value)||0;fetch(`/api/rh/extrato/${document.getElementById(`mgr-pgto-func`).value}`).then(e=>e.json()).then(t=>{let n=(t.total_vales||0)+(t.total_consumo||0),r=Math.max(0,e-n);document.getElementById(`mgr-pgto-liquido`).textContent=`R$ ${r.toFixed(2)}`}).catch(()=>{document.getElementById(`mgr-pgto-liquido`).textContent=`R$ ${e.toFixed(2)}`})},window.confirmarPagamento=function(){let e=document.getElementById(`mgr-pgto-func`).value,t=parseFloat(document.getElementById(`mgr-pgto-bruto`).value),n=document.getElementById(`mgr-pgto-obs`).value||`Pagamento via Painel Gerente`;if(!e)return alert(`Selecione um colaborador.`);if(!t||t<=0)return alert(`Informe um valor bruto válido.`);fetch(`/api/rh/extrato/${e}`).then(e=>e.json()).then(r=>{let i=(r.total_vales||0)+(r.total_consumo||0),a=Math.max(0,t-i),o=(r.vales||[]).map(e=>e.id),s=(r.fiados||[]).map(e=>e.id);fetch(`/api/rh/pagamentos`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({funcionario_id:parseInt(e),valor_bruto:t,total_vales_abatidos:r.total_vales||0,total_consumo_abatido:r.total_consumo||0,valor_liquido:a,observacao:n,vales_ids:o,pedidos_ids:s})}).then(e=>e.json()).then(e=>{e.ok?(fecharModal(`modal-mgr-pagamento`),alert(`Pagamento de R$ ${a.toFixed(2)} registrado com sucesso!`),w()):alert(e.erro||`Erro ao registrar pagamento.`)}).catch(()=>alert(`Erro ao conectar com o servidor.`))}).catch(()=>alert(`Erro ao carregar dados do colaborador.`))},window.openModalDespesa=function(){document.getElementById(`modal-mgr-despesa`).style.display=`flex`,document.getElementById(`mgr-despesa-valor`).value=``,document.getElementById(`mgr-despesa-desc`).value=``},window.confirmarDespesa=function(){let t=parseFloat(document.getElementById(`mgr-despesa-valor`).value),n=document.getElementById(`mgr-despesa-desc`).value.trim(),r=document.getElementById(`mgr-despesa-forma`).value;if(!t||t<=0)return alert(`Informe um valor válido.`);if(!n)return alert(`Informe uma descrição para a despesa.`);e.emit(`add_despesa`,{valor:t,descricao:n,forma_pagamento:r}),e.once(`financeiro_atualizado`,()=>{fecharModal(`modal-mgr-despesa`),alert(`Despesa registrada com sucesso!`)}),setTimeout(()=>{fecharModal(`modal-mgr-despesa`),alert(`Despesa registrada!`)},1500)},window.openModalNfMercadorias=function(){document.getElementById(`modal-mgr-nf`).style.display=`flex`,document.getElementById(`mgr-nf-form`).style.display=`block`,document.getElementById(`mgr-nf-lista`).style.display=`none`,document.getElementById(`mgr-nf-numero`).value=``,document.getElementById(`mgr-nf-fornecedor`).value=``,document.getElementById(`mgr-nf-valor`).value=``,document.getElementById(`mgr-nf-data`).value=new Date().toISOString().split(`T`)[0],document.getElementById(`mgr-nf-obs`).value=``},window.confirmarNfMercadoria=function(){let t=document.getElementById(`mgr-nf-numero`).value.trim(),n=document.getElementById(`mgr-nf-fornecedor`).value.trim(),r=parseFloat(document.getElementById(`mgr-nf-valor`).value),i=document.getElementById(`mgr-nf-data`).value,a=document.getElementById(`mgr-nf-obs`).value.trim();if(!t)return alert(`Informe o número da NF.`);if(!n)return alert(`Informe o fornecedor.`);if(!r||r<=0)return alert(`Informe o valor total.`);e.emit(`add_nf_mercadoria`,{numero_nf:t,fornecedor:n,valor_total:r,data_emissao:i,observacao:a}),e.once(`nf_mercadoria_adicionada`,()=>{document.getElementById(`mgr-nf-numero`).value=``,document.getElementById(`mgr-nf-fornecedor`).value=``,document.getElementById(`mgr-nf-valor`).value=``,document.getElementById(`mgr-nf-obs`).value=``,alert(`NF registrada com sucesso!`)}),e.once(`nf_mercadoria_erro`,e=>alert(e||`Erro ao registrar NF.`))},window.carregarNfMercadorias=function(){let t=document.getElementById(`mgr-nf-lista`);t.innerHTML=`Carregando...`,e.emit(`get_nf_mercadorias`)},e.on(`nf_mercadorias_list`,e=>{let n=document.getElementById(`mgr-nf-lista`);if(n){if(!e||!e.length){n.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma NF registrada.</div>`;return}n.innerHTML=e.map(e=>`
    <div style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;">
      <div style="display:flex;justify-content:space-between;">
        <strong>NF ${t(e.numero_nf)}</strong>
        <span style="font-weight:700;">R$ ${parseFloat(e.valor_total).toFixed(2)}</span>
      </div>
      <div style="color:var(--text-muted);">${t(e.fornecedor)} — ${t(e.data_emissao||``)}</div>
      ${e.observacao?`<div style="opacity:0.6;font-size:11px;">${t(e.observacao)}</div>`:``}
    </div>
  `).join(``)}}),window.openModalAjustes=function(){document.getElementById(`modal-mgr-ajustes`).style.display=`flex`,document.getElementById(`mgr-ajuste-info`).style.display=`none`,document.getElementById(`mgr-ajuste-preco`).value=``,document.getElementById(`mgr-ajuste-estoque`).value=``,e.emit(`get_produtos`),e.once(`produtos_atualizados`,e=>{let n=document.getElementById(`mgr-ajuste-produto`);n&&(n.innerHTML=`<option value="">Selecione...</option>`+(e||[]).filter(e=>e.status===`ativo`).map(e=>`<option value="${e.id}" data-preco="${e.preco}" data-estoque="${e.estoque||0}" data-status="${e.status}">${t(e.nome)} — R$ ${parseFloat(e.preco).toFixed(2)}</option>`).join(``))})},window.carregarDadosProduto=function(){let e=document.getElementById(`mgr-ajuste-produto`),t=e.options[e.selectedIndex],n=document.getElementById(`mgr-ajuste-info`);if(!t||!t.value){n.style.display=`none`;return}n.style.display=`block`;let r=parseFloat(t.dataset.preco)||0,i=parseFloat(t.dataset.estoque)||0,a=t.dataset.status;n.innerHTML=`
    <strong>${t.text.split(` — `)[0]}</strong><br>
    Preço atual: <strong>R$ ${r.toFixed(2)}</strong> | 
    Estoque: <strong>${i}</strong> | 
    Status: <strong style="color:${a===`ativo`?`#16a34a`:`#dc2626`};">${a}</strong>
  `,document.getElementById(`mgr-ajuste-preco`).value=r.toFixed(2),document.getElementById(`mgr-ajuste-estoque`).value=i},window.alternarStatusProduto=function(t){let n=document.getElementById(`mgr-ajuste-produto`),r=parseInt(n.value);if(!r)return alert(`Selecione um produto.`);e.emit(`edit_produto`,{id:r,status:t,operador:i?.nome||`Gerente`}),e.once(`produtos_atualizados`,()=>{alert(`Produto ${t===`ativo`?`ativado`:`desativado`}!`);let e=n.options[n.selectedIndex];e&&(e.dataset.status=t),carregarDadosProduto()})},window.salvarAjustePreco=function(){let t=document.getElementById(`mgr-ajuste-produto`),n=parseInt(t.value),r=parseFloat(document.getElementById(`mgr-ajuste-preco`).value);if(!n)return alert(`Selecione um produto.`);if(!r||r<=0)return alert(`Informe um preço válido.`);e.emit(`edit_produto`,{id:n,preco:r,operador:i?.nome||`Gerente`}),e.once(`produtos_atualizados`,()=>{alert(`Preço atualizado!`),carregarDadosProduto()})},window.salvarAjusteEstoque=function(){let t=document.getElementById(`mgr-ajuste-produto`),n=parseInt(t.value),r=parseFloat(document.getElementById(`mgr-ajuste-estoque`).value);if(!n)return alert(`Selecione um produto.`);if(isNaN(r))return alert(`Informe uma quantidade válida.`);e.emit(`atualizar_estoque`,{id:n,quantidade:r,operador:i?.nome||`Gerente`}),e.once(`produtos_atualizados`,()=>{alert(`Estoque atualizado!`),carregarDadosProduto()})},window.openModalPontoHoje=function(){document.getElementById(`modal-mgr-ponto-hoje`).style.display=`flex`,document.getElementById(`mgr-ponto-hoje-content`).innerHTML=`Carregando...`;let n=new Date().toISOString().split(`T`)[0];e.emit(`get_rh_data`,{start_date:n,end_date:n}),e.once(`rh_data`,e=>{let r=document.getElementById(`mgr-ponto-hoje-content`);if(!r)return;let i=(e.pontos||[]).filter(e=>e.data===n);if(!i.length){r.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum registro de ponto hoje.</div>`;return}r.innerHTML=i.map(e=>{let n=e.entrada?new Date(e.entrada).toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`}):`--:--`,r=e.saida?new Date(e.saida).toLocaleTimeString(`pt-BR`,{hour:`2-digit`,minute:`2-digit`}):`<span style="color:#facc15;">em aberto</span>`,i=e.total_horas?parseFloat(e.total_horas).toFixed(1)+`h`:`--`;return`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <span><strong>${t(e.funcionario_nome)}</strong></span>
        <span>${n} → ${r} <span style="color:var(--text-muted);font-size:12px;">${i}</span></span>
      </div>`}).join(``)})};var E=[];window.openModalColaboradores=function(){document.getElementById(`modal-mgr-colaboradores`).style.display=`flex`,document.getElementById(`mgr-colaboradores-form`).style.display=`none`,document.getElementById(`mgr-colab-search`).value=``,D()};function D(t){let n=document.getElementById(`mgr-colaboradores-lista`);n.innerHTML=`Carregando...`,e.emit(`get_funcionarios`),e.once(`funcionarios_atualizados`,e=>{E=e||[],O(t)})}function O(e){let n=document.getElementById(`mgr-colaboradores-lista`),r=E;if(e){let t=e.toLowerCase();r=r.filter(e=>e.nome?.toLowerCase().includes(t)||e.cargo?.toLowerCase().includes(t))}if(!r.length){n.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum colaborador encontrado.</div>`;return}n.innerHTML=r.map(e=>{let n=e.status===`Ativo`?`#16a34a`:`#94a3b8`;return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;">
      <div style="flex:1;">
        <strong>${t(e.nome)}</strong><br>
        <span style="font-size:11px;color:var(--text-muted);">${t(e.cargo||``)} ${e.valor_hora?`- R$ `+parseFloat(e.valor_hora).toFixed(2)+`/h`:``}</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="background:${n};color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">${e.status}</span>
        <button onclick="editarColaborador(${e.id})" style="background:none;border:none;cursor:pointer;font-size:16px;color:#6c5ce7;"><i class="ph ph-pencil-simple"></i></button>
        <button onclick="alternarStatusColaborador(${e.id}, '${t(e.status)}')" style="background:none;border:none;cursor:pointer;font-size:16px;color:${e.status===`Ativo`?`#dc2626`:`#16a34a`};"><i class="ph ${e.status===`Ativo`?`ph-prohibit`:`ph-check-circle`}"></i></button>
      </div>
    </div>`}).join(``)}window.filtrarColaboradores=function(e){O(e)},window.abrirFormColaborador=function(){document.getElementById(`mgr-colab-id`).value=``,document.getElementById(`mgr-colab-nome`).value=``,document.getElementById(`mgr-colab-usuario`).value=``,document.getElementById(`mgr-colab-senha`).value=``,document.getElementById(`mgr-colab-cargo`).value=`Garçom`,document.getElementById(`mgr-colab-valor-hora`).value=``,document.getElementById(`mgr-colab-telefone`).value=``,document.getElementById(`mgr-colaboradores-form`).style.display=`block`},window.cancelarFormColaborador=function(){document.getElementById(`mgr-colaboradores-form`).style.display=`none`},window.editarColaborador=function(e){let t=E.find(t=>t.id===e);t&&(document.getElementById(`mgr-colab-id`).value=t.id,document.getElementById(`mgr-colab-nome`).value=t.nome||``,document.getElementById(`mgr-colab-usuario`).value=t.usuario||``,document.getElementById(`mgr-colab-senha`).value=``,document.getElementById(`mgr-colab-cargo`).value=t.cargo||`Garçom`,document.getElementById(`mgr-colab-valor-hora`).value=t.valor_hora||``,document.getElementById(`mgr-colab-telefone`).value=t.telefone||``,document.getElementById(`mgr-colaboradores-form`).style.display=`block`)},window.salvarColaborador=function(){let t=document.getElementById(`mgr-colab-id`).value,n=document.getElementById(`mgr-colab-nome`).value.trim(),r=document.getElementById(`mgr-colab-usuario`).value.trim(),i=document.getElementById(`mgr-colab-senha`).value,a=document.getElementById(`mgr-colab-cargo`).value,o=parseFloat(document.getElementById(`mgr-colab-valor-hora`).value)||0,s=document.getElementById(`mgr-colab-telefone`).value.trim();if(!n||!r)return alert(`Nome e usuário são obrigatórios.`);if(!t&&!i)return alert(`Informe uma senha para o novo colaborador.`);let c={nome:n,usuario:r,cargo:a,valor_hora:o,telefone:s};i&&(c.senha=i),t?(c.id=parseInt(t),e.emit(`update_funcionario`,c)):e.emit(`add_funcionario`,c),e.once(`funcionarios_atualizados`,()=>{document.getElementById(`mgr-colaboradores-form`).style.display=`none`,alert(t?`Colaborador atualizado!`:`Colaborador adicionado!`),D()})},window.alternarStatusColaborador=function(t,n){let r=n===`Ativo`?`Inativo`:`Ativo`;confirm(`Deseja ${r===`Ativo`?`ativar`:`desativar`} este colaborador?`)&&(e.emit(`update_funcionario`,{id:t,status:r}),e.once(`funcionarios_atualizados`,()=>D()))},window.openModalRelampago=function(){document.getElementById(`modal-mgr-relampago`).style.display=`flex`,document.getElementById(`mgr-relampago-content`).innerHTML=`Carregando...`,e.emit(`get_dashboard_stats`),e.once(`dashboard_stats_result`,e=>{let n=document.getElementById(`mgr-relampago-content`);n&&(n.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Faturamento Hoje</div>
          <div style="font-size:22px;font-weight:800;color:#16a34a;">R$ ${(e.faturamentoHoje||0).toFixed(2)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Faturamento Mês</div>
          <div style="font-size:22px;font-weight:800;color:#2563eb;">R$ ${(e.faturamentoMensal||0).toFixed(2)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Pedidos Hoje</div>
          <div style="font-size:22px;font-weight:800;color:#ca8a04;">${e.pedidosHoje||0}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Ticket Médio</div>
          <div style="font-size:22px;font-weight:800;color:#6c5ce7;">R$ ${(e.ticketMedio||0).toFixed(2)}</div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);padding:12px;border-radius:10px;text-align:center;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--text-muted);">Projeção de Fechamento do Mês</div>
        <div style="font-size:22px;font-weight:800;color:#059669;">R$ ${(e.projecaoMensal||0).toFixed(2)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${e.diasTranscorridos||0} de ${e.diasTotalMes||0} dias (${e.diasTranscorridos&&e.diasTotalMes?Math.round(e.diasTranscorridos/e.diasTotalMes*100):0}% do mês)</div>
      </div>
      ${(e.produtosPopulares||[]).length?`
        <div style="margin-top:8px;">
          <strong style="font-size:13px;">Produtos Populares (Hoje)</strong>
          ${e.produtosPopulares.slice(0,5).map(e=>`
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #f1f5f9;">
              <span>${t(e.productName)}</span>
              <span style="font-weight:600;">${e.qty}x</span>
            </div>
          `).join(``)}
        </div>
      `:``}
    `)})},window.openModalCaixaStatus=function(){document.getElementById(`modal-mgr-caixa`).style.display=`flex`,document.getElementById(`mgr-caixa-content`).innerHTML=`Carregando...`,e.emit(`get_relatorio_caixa`),e.once(`relatorio_caixa`,e=>{let t=document.getElementById(`mgr-caixa-content`);if(!t)return;if(!e){t.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Caixa está fechado no momento.</div>`;return}let n=e=>`R$ ${(e||0).toFixed(2)}`;t.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Fundo Troco</div>
          <div style="font-size:18px;font-weight:800;color:#16a34a;">${n(e.fundo_troco)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Dinheiro</div>
          <div style="font-size:18px;font-weight:800;color:#2563eb;">${n(e.total_dinheiro)}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">PIX</div>
          <div style="font-size:18px;font-weight:800;color:#6c5ce7;">${n(e.total_pix)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Cartão</div>
          <div style="font-size:18px;font-weight:800;color:#ca8a04;">${n((e.total_credito||0)+(e.total_debito||0))}</div>
        </div>
      </div>
      <div style="font-size:13px;border-top:1px solid #e2e8f0;padding-top:8px;">
        ${e.total_sangria>0?`<div style="display:flex;justify-content:space-between;"><span>Sangrias</span><span style="color:#dc2626;">${n(e.total_sangria)}</span></div>`:``}
        ${e.total_suprimento>0?`<div style="display:flex;justify-content:space-between;"><span>Suprimentos</span><span style="color:#16a34a;">${n(e.total_suprimento)}</span></div>`:``}
      </div>
    `})};var k=[];window.openModalEstoque=function(){document.getElementById(`modal-mgr-estoque`).style.display=`flex`,mostrarAbaEstoque(`entrada`),e.emit(`get_estoque_produtos`),e.once(`estoque_produtos_list`,e=>{k=e||[];let n=document.getElementById(`mgr-estq-produto`);n&&(n.innerHTML=`<option value="">Selecione...</option>`+e.map(e=>`<option value="${e.id}" data-categoria="${e.categoria}">${t(e.emoji||``)} ${t(e.nome)} (${t(e.categoria)}) — Est: ${e.estoque||0}</option>`).join(``))}),e.emit(`get_nf_mercadorias`),e.once(`nf_mercadorias_list`,e=>{let n=document.getElementById(`mgr-estq-nf`);n&&(n.innerHTML=`<option value="">Nenhuma</option>`+(e||[]).map(e=>`<option value="${e.id}">NF ${t(e.numero_nf)} — ${t(e.fornecedor)}</option>`).join(``))})},window.buscarProdutoPorBarcode=function(){let t=document.getElementById(`mgr-estq-barcode`),n=t?t.value.trim():``;n&&(e.emit(`get_produto_by_barcode`,n),e.once(`produto_by_barcode_result`,e=>{let n=document.getElementById(`mgr-estq-produto`);if(n){if(!e){alert(`Produto não encontrado para o código de barras informado.`);return}for(let t=0;t<n.options.length;t++)if(parseInt(n.options[t].value)===e.id){n.selectedIndex=t;break}t.value=``,document.getElementById(`mgr-estq-qtd`).focus()}}))},window.mostrarAbaEstoque=function(e){document.getElementById(`mgr-estq-entrada`).style.display=e===`entrada`?`block`:`none`,document.getElementById(`mgr-estq-atual`).style.display=e===`atual`?`block`:`none`,document.getElementById(`mgr-estq-validade-aba`).style.display=e===`validade`?`block`:`none`,document.getElementById(`mgr-estq-movimentos`).style.display=e===`movimentos`?`block`:`none`,e===`atual`&&renderEstoqueAtual(),e===`validade`&&carregarProdutosValidade(),e===`movimentos`&&carregarMovimentosEstoque();let t=document.querySelectorAll(`#modal-mgr-estoque .btn-main`),n={entrada:0,atual:1,validade:2,movimentos:3};t.forEach((t,r)=>{t.style.background=r===n[e]?`#9b59b6`:`#2c3e50`})},window.confirmarEntradaEstoque=function(){let t=parseInt(document.getElementById(`mgr-estq-produto`).value),n=parseFloat(document.getElementById(`mgr-estq-qtd`).value),r=parseFloat(document.getElementById(`mgr-estq-custo`).value)||0,i=document.getElementById(`mgr-estq-fornecedor`).value.trim(),a=document.getElementById(`mgr-estq-validade`).value||null,o=parseInt(document.getElementById(`mgr-estq-nf`).value)||null,s=document.getElementById(`mgr-estq-obs`).value.trim();if(!t)return alert(`Selecione um produto.`);if(!n||n<=0)return alert(`Informe a quantidade.`);e.emit(`add_estoque_movimento`,{produto_id:t,tipo:`entrada`,quantidade:n,custo_unitario:r,fornecedor:i,data_validade:a,nf_mercadoria_id:o,observacao:s}),e.once(`estoque_movimento_adicionado`,()=>{document.getElementById(`mgr-estq-qtd`).value=``,document.getElementById(`mgr-estq-custo`).value=``,document.getElementById(`mgr-estq-fornecedor`).value=``,document.getElementById(`mgr-estq-validade`).value=``,document.getElementById(`mgr-estq-obs`).value=``,alert(`Entrada de estoque registrada!`),mostrarAbaEstoque(`atual`)}),e.once(`estoque_erro`,e=>alert(e))},window.carregarProdutosValidade=function(){let n=document.getElementById(`mgr-estq-validade-lista`);if(!n)return;n.innerHTML=`Carregando...`;let r=parseInt(document.getElementById(`mgr-validade-dias`).value)||30;e.emit(`get_produtos_validade`,r),e.once(`produtos_validade_result`,e=>{if(!n)return;if(!e||!e.length){n.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum produto próximo ao vencimento.</div>`;return}let r=new Date;n.innerHTML=e.map(e=>{let n=new Date(e.data_validade+`T23:59:59`),i=Math.ceil((n-r)/(1e3*60*60*24)),a=i<=0?`<span style="color:#dc2626;font-weight:700;">VENCIDO</span>`:i<=7?`<span style="color:#dc2626;font-weight:700;">${i}d</span>`:i<=14?`<span style="color:#eab308;font-weight:600;">${i}d</span>`:i<=30?`<span style="color:#f97316;">${i}d</span>`:`<span style="color:var(--text-muted);">${i}d</span>`,o=(e.estoque_atual||0)*(e.produto_preco||0);return`<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${t(e.produto_emoji||``)} ${t(e.produto_nome)}</strong><br>
            <span style="font-size:11px;color:var(--text-muted);">${t(e.produto_categoria)} | Est: ${e.estoque_atual||0} un | R$ ${o.toFixed(2)}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:800;">${a}</div>
            <div style="font-size:10px;color:var(--text-muted);">${new Date(e.data_validade).toLocaleDateString(`pt-BR`)}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#2563eb;" onclick="alert('Ação: Criar combo com ${t(e.produto_nome)}')"><i class="ph ph-stack"></i> Criar Combo</button>
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#16a34a;" onclick="alert('Ação: Aplicar desconto em ${t(e.produto_nome)}')"><i class="ph ph-percent"></i> Desconto</button>
          <button class="btn-main" style="flex:1;font-size:11px;padding:6px;background:#dc2626;" onclick="alert('Ação: Descartar ${t(e.produto_nome)}')"><i class="ph ph-trash"></i> Descartar</button>
        </div>
      </div>`}).join(``)})},window.renderEstoqueAtual=function(n){let r=document.getElementById(`mgr-estq-atual-lista`);if(!r)return;let i=k;if(n){let e=n.toLowerCase();i=i.filter(t=>t.nome?.toLowerCase().includes(e)||t.categoria?.toLowerCase().includes(e))}if(!i.length){r.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum produto encontrado.</div>`;return}e.emit(`get_produtos`),e.once(`produtos_atualizados`,e=>{if(k=e||[],i=e||[],n){let e=n.toLowerCase();i=i.filter(t=>t.nome?.toLowerCase().includes(e)||t.categoria?.toLowerCase().includes(e))}r.innerHTML=i.map(e=>`
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
        <div><strong>${t(e.emoji||``)} ${t(e.nome)}</strong><br><span style="font-size:11px;color:var(--text-muted);">${t(e.categoria)} | Custo: R$ ${parseFloat(e.custo||0).toFixed(2)} | Venda: R$ ${parseFloat(e.preco||0).toFixed(2)}</span></div>
        <div style="text-align:right;">
          <span style="font-size:18px;font-weight:800;color:${(e.estoque||0)>0?`#16a34a`:`#dc2626`};">${e.estoque||0}</span>
          <br><span style="font-size:10px;color:var(--text-muted);">em estoque</span>
        </div>
      </div>
    `).join(``)})},window.carregarMovimentosEstoque=function(){let n=document.getElementById(`mgr-estq-mov-lista`);if(!n)return;n.innerHTML=`Carregando...`;let r={start_date:document.getElementById(`mgr-estq-mov-dtini`).value||void 0,end_date:document.getElementById(`mgr-estq-mov-dtfim`).value||void 0};r.start_date||delete r.start_date,r.end_date||delete r.end_date,e.emit(`get_estoque_movimentacoes`,r),e.once(`estoque_movimentacoes_list`,e=>{if(!e||!e.length){n.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum movimento encontrado.</div>`;return}n.innerHTML=e.map(e=>{let n=e.tipo===`entrada`?`#16a34a`:`#dc2626`,r=e.tipo===`entrada`?`+`:`-`,i=e.data_movimento?new Date(e.data_movimento).toLocaleString(`pt-BR`):``;return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <div>
          <strong>${t(e.produto_nome)}</strong><br>
          <span style="font-size:11px;color:var(--text-muted);">${i} ${e.fornecedor?`— `+t(e.fornecedor):``}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-weight:700;color:${n};">${r}${e.quantidade}</span><br>
          <span style="font-size:11px;color:var(--text-muted);">R$ ${parseFloat(e.custo_unitario||0).toFixed(2)}/un</span>
        </div>
      </div>`}).join(``)})},window.openModalProjecao=function(){document.getElementById(`modal-mgr-projecao`).style.display=`flex`;let e=new Date,t=new Date(e.getFullYear(),e.getMonth(),1);document.getElementById(`mgr-proj-dtini`).value=t.toISOString().split(`T`)[0],document.getElementById(`mgr-proj-dtfim`).value=e.toISOString().split(`T`)[0],carregarProjecao()},window.carregarProjecao=function(){let t=document.getElementById(`mgr-projecao-content`);if(!t)return;t.innerHTML=`Carregando...`;let n={start_date:document.getElementById(`mgr-proj-dtini`).value||void 0,end_date:document.getElementById(`mgr-proj-dtfim`).value||void 0};n.start_date||delete n.start_date,n.end_date||delete n.end_date,e.emit(`get_estoque_metrics`,n),e.once(`estoque_metrics_result`,e=>{if(!t)return;let n=e=>`R$ ${(e||0).toFixed(2)}`;t.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Custo Total Estoque</div>
          <div style="font-size:20px;font-weight:800;color:#dc2626;">${n(e.custo_total)}</div>
        </div>
        <div style="background:#f0f9ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Receita Potencial</div>
          <div style="font-size:20px;font-weight:800;color:#2563eb;">${n(e.receita_potencial)}</div>
        </div>
        <div style="background:#fefce8;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Lucro Projetado</div>
          <div style="font-size:20px;font-weight:800;color:#16a34a;">${n(e.lucro_potencial)}</div>
        </div>
        <div style="background:#f5f3ff;padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Produtos em Estoque</div>
          <div style="font-size:20px;font-weight:800;color:#6c5ce7;">${e.total_produtos_estoque}</div>
        </div>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:12px;">
        <strong style="font-size:14px;">Período Filtrado</strong>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total entradas (custo)</span>
          <span style="font-weight:600;">${n(e.total_entradas_periodo)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total itens entrados</span>
          <span style="font-weight:600;">${e.total_itens_entrados_periodo}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>Total NF recebidas</span>
          <span style="font-weight:600;">${n(e.total_nfs_periodo)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px;color:var(--text-muted);">
          <span>Margem projetada</span>
          <span style="font-weight:700;color:${e.receita_potencial>e.custo_total?`#16a34a`:`#dc2626`};">
            ${e.custo_total>0?((e.receita_potencial-e.custo_total)/e.custo_total*100).toFixed(1):`0`}%
          </span>
        </div>
      </div>
    `})};