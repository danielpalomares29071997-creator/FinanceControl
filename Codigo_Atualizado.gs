// Apps Script exemplo para usar como API com Google Sheets
// Versão atualizada com suporte a Realizado vs Previsto
// Copie e cole no editor do Google Apps Script, vinculado à sua planilha

const SPREADSHEET_ID = ''; // opcional: preencha se o script NÃO estiver vinculado à planilha

function getSpreadsheet() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const sheetInv = ss.getSheetByName('Investimentos');
    const sheetWallet = ss.getSheetByName('Carteira');

    // Adicionar mapeamento para "Realizado/Previsto"
    const investments = sheetToObjects(sheetInv, {
      'ID':'id','Data':'date','Ativo':'name','Instituição':'institution',
      'Instituicao':'institution','Tipo':'type','Valor':'value','Vencimento':'expiry',
      'Taxa':'ratePrev','Status':'status','Realizado/Previsto':'realizadoPrevisto'
    });

    const transactions = sheetToObjects(sheetWallet, {
      'ID':'id','Data':'date','Tipo':'type','Carteira':'wallet','Categoria':'category',
      'Descrição':'desc','Descricao':'desc','Valor':'value','Realizado/Previsto':'realizadoPrevisto'
    });

    // Converter "Realizado/Previsto" de volta para formato "yes"/"no" do frontend
    const investmentsNormalized = investments.map(inv => ({
      ...inv,
      dataType: 'investment',
      realized: (inv.realizadoPrevisto === 'Realizado' || inv.realizadoPrevisto === 'Sim') ? 'yes' : 'no'
    }));

    const transactionsNormalized = transactions.map(tx => ({
      ...tx,
      dataType: 'transaction',
      realized: (tx.realizadoPrevisto === 'Realizado' || tx.realizadoPrevisto === 'Sim') ? 'yes' : 'no'
    }));

    const payload = { investments: investmentsNormalized, transactions: transactionsNormalized };
    
    // Suporte a JSONP: se o parâmetro 'callback' for fornecido, devolve chamada JS
    if (e && e.parameter && e.parameter.callback) {
      const cb = e.parameter.callback;
      return ContentService.createTextOutput(cb + '(' + JSON.stringify(payload) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if(!e || !e.postData || !e.postData.contents) throw new Error('No post data');
    const ss = getSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    
    Logger.log('doPost received: ' + JSON.stringify(data));

    // Converter "yes"/"no" para "Realizado"/"Previsto"
    const status = (data.realized === 'yes' || data.realized === true) ? 'Realizado' : 'Previsto';

    if (data.dataType === 'transaction') {
      let sheet = ss.getSheetByName('Carteira');
      if (!sheet) {
        sheet = ss.insertSheet('Carteira');
        sheet.appendRow(['ID','Data','Tipo','Carteira','Categoria','Subcategoria','Descrição','Valor','Conta','Realizado/Previsto']);
      }
      sheet.appendRow([
        data.id, 
        data.date, 
        data.type, 
        data.wallet, 
        data.category || '', 
        data.subcategory || '',
        data.desc || '', 
        Number(data.value) || 0,
        data.account || '',
        status
      ]);

    } else if (data.dataType === 'investment') {
      let sheet = ss.getSheetByName('Investimentos');
      if (!sheet) {
        sheet = ss.insertSheet('Investimentos');
        sheet.appendRow(['ID','Data','Ativo','Instituição','Tipo','Valor','Vencimento','Taxa','Status','Realizado/Previsto']);
      }
      sheet.appendRow([
        data.id, 
        data.date, 
        data.name || '', 
        data.institution || '', 
        data.type || '', 
        Number(data.value) || 0, 
        data.expiry || '', 
        data.ratePrev || '', 
        data.status || '',
        status
      ]);
      
    } else if (data.dataType === 'plan') {
      let sheet = ss.getSheetByName('Planejamento');
      if (!sheet) {
        sheet = ss.insertSheet('Planejamento');
        sheet.appendRow(['ID','MesAno','Categoria','ValorMeta','Realizado/Previsto']);
      }
      sheet.appendRow([
        data.id,
        data.monthYear || '',
        data.category || '',
        Number(data.targetValue) || 0,
        status
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sheetToObjects(sheet, headerMap) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0].map(h => (h || '').toString().trim());
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const hdr = headers[j];
      const key = headerMap && headerMap[hdr] ? headerMap[hdr] : hdr;
      let val = row[j];
      if (val instanceof Date) val = formatDate(val);
      if (key === 'value' || key === 'value') val = Number(val) || 0;
      obj[key] = val;
    }
    result.push(obj);
  }
  return result;
}

function formatDate(dateVal) {
  if (dateVal instanceof Date) {
    return dateVal.getFullYear() + '-' + ('0' + (dateVal.getMonth() + 1)).slice(-2) + '-' + ('0' + dateVal.getDate()).slice(-2);
  }
  return String(dateVal || '');
}
