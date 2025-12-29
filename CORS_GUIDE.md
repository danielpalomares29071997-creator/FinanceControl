# 🔧 Guia de Resolução: Erro de CORS com Google Apps Script

## 🔴 Problema
Ao acessar o site em **GitHub Pages** (`https://danielpalomares29071997-creator.github.io`), você recebe:
```
Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

Mas funciona normalmente em **localhost** (`http://localhost:8000`)

---

## ✅ Soluções

### **Solução 1: Testar se o Apps Script está respondendo corretamente** ⭐ RECOMENDADO

1. **No navegador (GitHub Pages)**, abra o **Console** (F12 → Console)
2. Digite:
   ```javascript
   testGoogleSheetsConnection()
   ```
3. Observe os logs para saber exatamente qual é o problema

Se falhar, continue com as soluções abaixo.

---

### **Solução 2: Configurar o Apps Script para retornar CORS Headers**

No seu Google Apps Script, modifique a função `doGet()` para incluir headers CORS:

```javascript
function doGet(e) {
  try {
    // ... código existente ...
    
    const payload = { investments: investmentsNormalized, transactions: transactionsNormalized };
    
    // Suporte a JSONP
    if (e && e.parameter && e.parameter.callback) {
      const cb = e.parameter.callback;
      return ContentService.createTextOutput(cb + '(' + JSON.stringify(payload) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
        .addHeader('Access-Control-Allow-Origin', '*')
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader('Access-Control-Allow-Origin', '*')
      .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .addHeader('Access-Control-Allow-Headers', 'Content-Type');
      
  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader('Access-Control-Allow-Origin', '*');
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

Depois:
1. **Salve** (Ctrl+S)
2. **Deploy → Manage deployments → Atualizar** (clique no ícone ⚙️ ao lado da URL)
3. Escolha a versão mais recente e clique **Deploy**
4. Recarregue seu site e teste novamente

---

### **Solução 3: Usar um Proxy (Se as soluções anteriores não funcionarem)**

Se o Apps Script continuar recusando CORS, use um proxy CORS gratuito:

**Opção A: CORS Anywhere (Simples, mas limite de 50 requisições/hora)**
```javascript
// No script.js, mude:
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/...";

// Para:
const GOOGLE_SHEET_URL = "https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/.../exec";
```

**Opção B: Usar serviço AllOrigins**
```javascript
const GOOGLE_SHEET_URL = "https://api.allorigins.win/raw?url=https://script.google.com/macros/s/.../exec";
```

⚠️ **Desvantagens:**
- Requisições são mais lentas
- Dependência de um terceiro
- Limite de requisições pode ser atingido

---

### **Solução 4: Usar apenas localStorage (Fallback)**

Se quiser que o app funcione **sem sincronizar com o Google Sheets**, o site já funciona perfeitamente usando apenas `localStorage`:

1. Todos os dados são salvos no navegador
2. Você pode exportar/importar manualmente
3. O ícone de sincronização mostrará 🔴 "Local"

---

## 📊 Como funciona a sincronização:

```
📱 Site (GitHub Pages / localhost)
  │
  ├─ Salvamento: localStorage (sempre funciona)
  └─ Sincronização: JSONP do Google Apps Script (requer CORS)
      │
      └─ GET: Carregar dados da planilha
      └─ POST: Enviar novos dados para a planilha
```

---

## 🎯 Resumo da Sequência de Resolução

1. **Primeiro:** Teste com `testGoogleSheetsConnection()` no console
2. **Depois:** Adicione CORS headers no Apps Script (Solução 2)
3. **Se não funcionar:** Use um proxy (Solução 3)
4. **Como último recurso:** Apenas localStorage (Solução 4)

---

## 🧪 Testando Localmente (Recomendado)

Em `http://localhost:8000`, tudo deve funcionar sem problemas de CORS.

Para testar:
```bash
# Na pasta do projeto:
python3 -m http.server 8000

# Abra: http://localhost:8000
```

---

## 📞 Diagnosticando o Problema

**Console do Navegador (F12):**

✅ **Sucesso (verde):**
```
✓ JSONP funcionando!
Dados recebidos: {investments: [...], transactions: [...]}
Status: Online
```

❌ **Erro CORS:**
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked
Status: Local
```

❌ **Timeout (Apps Script lento ou inacessível):**
```
JSONP timeout (8 segundos)
Status: Local
```

---

## 💡 Dica Importante

Quando estiver desenvolvendo **localmente em `http://localhost:8000`**, não há problema de CORS. O problema aparece quando o site está em **HTTPS (GitHub Pages)**.

Se quiser testar em GitHub Pages antes de resolver CORS, você pode:
1. Desabilitar a sincronização temporariamente
2. Usar o fallback localStorage
3. Depois implementar a solução CORS

---

## 📋 Checklist Final

- [ ] Testei `testGoogleSheetsConnection()` no console
- [ ] Apps Script está deployado como "Web app"
- [ ] Permissão é "Anyone, even anonymous"
- [ ] Adicionei headers CORS no Apps Script
- [ ] Redeployei o Apps Script após as mudanças
- [ ] Recarreguei a página (Ctrl+Shift+R para hard refresh)
- [ ] O ícone de sincronização mostra 🟢 "Online"

---

**Problemas?** Abra o console (F12) e execute:
```javascript
testGoogleSheetsConnection()
```
Compartilhe o resultado para diagnóstico!
