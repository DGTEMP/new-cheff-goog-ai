import sys

fpath = r'c:\Users\computer\Desktop\chef cozinha\financeiro.html'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

s_mark = '<!-- Section 1: Cashier Shift Dashboard (Resumo do Turno) -->'
e_mark = '<div style="background: white; padding: 24px;'

s_idx = text.find(s_mark)
e_idx = text.find(e_mark)

print('s_idx:', s_idx, 'e_idx:', e_idx)

replacement = """<!-- Section 1: Cashier Shift Dashboard (Resumo do Turno) -->
      <div id="section-resumo-caixa" style="display: block;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h1>Dashboard Financeiro</h1>
          <button id="btn-fechar-caixa-oficial" style="background: #eb5757; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="ph ph-lock-key"></i> FECHAR TURNO E IMPRIMIR
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="color: gray; font-size: 14px;">Fundo de Troco</div>
            <div id="card-troco" style="font-size: 26px; font-weight: bold; color: #333; margin-top: 4px;">R$ 0,00</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="color: gray; font-size: 14px;">Dinheiro em Gaveta</div>
            <div id="card-gaveta" style="font-size: 26px; font-weight: bold; color: #3ab55b; margin-top: 4px;">R$ 0,00</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="color: gray; font-size: 14px;">Total Faturado (Vendas)</div>
            <div id="card-faturado" style="font-size: 26px; font-weight: bold; color: #fc4b15; margin-top: 4px;">R$ 0,00</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="color: gray; font-size: 14px;">Pagamentos Eletrônicos</div>
            <div id="card-eletronico" style="font-size: 26px; font-weight: bold; color: #8e44ad; margin-top: 4px;">R$ 0,00</div>
          </div>
          <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 1px solid #fecaca; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="color: #991b1b; font-size: 14px; font-weight: 600;"><i class="ph ph-percent"></i> Descontos Concedidos</div>
            <div id="card-descontos" style="font-size: 26px; font-weight: bold; color: #dc2626; margin-top: 4px;">R$ 0,00</div>
          </div>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <button id="btn-sangria" style="background: #fff; border: 1px solid #eb5757; color: #eb5757; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            <i class="ph ph-arrow-down"></i> Registrar Sangria (Retirada)
          </button>
          <button id="btn-suprimento" style="background: #fff; border: 1px solid #3ab55b; color: #3ab55b; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
            <i class="ph ph-arrow-up"></i> Registrar Suprimento (Entrada)
          </button>
        </div>

        """

if s_idx != -1 and e_idx != -1:
    new_text = text[:s_idx] + replacement + text[e_idx:]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("SUCCESS: Updated section-resumo-caixa in financeiro.html")
else:
    print("ERROR: Indexes not found.")
