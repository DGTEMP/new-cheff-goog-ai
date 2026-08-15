const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const btnGarcom = `
          <div class="action-group" style="margin-top: auto;">
            <button class="btn-action" onclick="window.open('/garcom.html', '_blank')" style="background: #e3fafc; color: #0b7285; border: 1px solid #99e9f2; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; width: 100%;">
              <i class="ph ph-device-mobile" style="font-size: 20px;"></i>
              App Garçom
            </button>
          </div>
`;

if (!html.includes('App Garçom')) {
    html = html.replace(
        '              </button>\n            </div>\n          </div>\n  \n        </aside>',
        '              </button>\n            </div>\n          </div>\n' + btnGarcom + '  \n        </aside>'
    );
}

fs.writeFileSync('index.html', html);
console.log('App Garçom added!');
