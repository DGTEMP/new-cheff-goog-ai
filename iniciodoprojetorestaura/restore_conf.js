const fs = require('fs');
let html = fs.readFileSync('configuracoes.html', 'utf8');

const replacement = `          <button class="btn-action admin-tab-btn" data-tab="mesas">
            <i class="ph ph-squares-four"></i> Mesas
          </button>
          <button class="btn-action admin-tab-btn" data-tab="funcionarios">
            <i class="ph ph-users"></i> Funcionários
          </button>
          <button class="btn-action admin-tab-btn" data-tab="clientes">
            <i class="ph ph-user-circle"></i> Clientes
          </button>
          <button class="btn-action admin-tab-btn" data-tab="promocoes">
            <i class="ph ph-tag"></i> Promoções
          </button>
          <button class="btn-action admin-tab-btn" data-tab="rh">
            <i class="ph ph-hand-coins"></i> RH / Folha
          </button>
        </div>

        <div class="action-group">
          <div class="group-title">Segurança</div>
          <button class="btn-action admin-tab-btn" data-tab="backup" style="color:#fc4b15;">
            <i class="ph ph-hard-drives"></i> Backup e Restore
          </button>
        </div>
      </aside>`;

// We will find the part from:
//           <button class="btn-action admin-tab-btn" data-tab="mesas">
//             <i class="ph ph-squares-four"></i> Mesas
//           </button>
// down to </aside> and replace it.

const startRegex = /<button class="btn-action admin-tab-btn" data-tab="mesas">[\s\S]*?<i class="ph ph-squares-four"><\/i> Mesas[\s\S]*?<\/button>/;
const endRegex = /<\/aside>/;

const startMatch = html.match(startRegex);
const endMatch = html.match(endRegex);

if (startMatch && endMatch) {
  const startIndex = startMatch.index;
  const endIndex = endMatch.index + '</aside>'.length;
  
  html = html.slice(0, startIndex) + replacement + '\n      </aside>' + html.slice(endIndex);
  fs.writeFileSync('configuracoes.html', html, 'utf8');
  console.log("Restored successfully!");
} else {
  console.log("Could not find boundaries.");
}
